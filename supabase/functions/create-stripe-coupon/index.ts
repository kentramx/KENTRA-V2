import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { getCorsHeaders, corsHeaders } from "../_shared/cors.ts";
import { maskEmail } from "../_shared/emailHelper.ts";
import { isNumber, isPositiveInteger, isString } from "../_shared/validation.ts";

serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    // ============================================
    // SECURITY: Verify user is authenticated and is super_admin
    // ============================================
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { headers: { ...headers, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Extract JWT token and verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { headers: { ...headers, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Verify user is super_admin
    const { data: isSuperAdmin, error: roleError } = await supabaseAdmin.rpc('is_super_admin', {
      user_uuid: user.id,
    });

    if (roleError || !isSuperAdmin) {
      console.error('Role check failed:', roleError, 'isSuperAdmin:', isSuperAdmin);
      return new Response(
        JSON.stringify({ error: 'Access denied. Super admin privileges required.' }),
        { headers: { ...headers, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // ============================================
    // Process coupon creation (admin verified)
    // ============================================
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    const { code, discount_type, discount_value, max_redemptions, valid_until } = await req.json();

    // Validate required fields
    if (!code || !discount_type || discount_value === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: code, discount_type, discount_value' }),
        { headers: { ...headers, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate code format (alphanumeric, 3-50 chars)
    if (!isString(code) || !/^[A-Za-z0-9_-]{3,50}$/.test(code)) {
      return new Response(
        JSON.stringify({ error: 'Invalid coupon code format. Use 3-50 alphanumeric characters.' }),
        { headers: { ...headers, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate discount_type
    if (!['percentage', 'fixed_amount'].includes(discount_type)) {
      return new Response(
        JSON.stringify({ error: 'discount_type must be "percentage" or "fixed_amount"' }),
        { headers: { ...headers, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate discount_value is a number
    if (!isNumber(discount_value)) {
      return new Response(
        JSON.stringify({ error: 'discount_value must be a number' }),
        { headers: { ...headers, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate discount value range
    if (discount_type === 'percentage' && (discount_value < 1 || discount_value > 100)) {
      return new Response(
        JSON.stringify({ error: 'Percentage discount must be between 1 and 100' }),
        { headers: { ...headers, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (discount_type === 'fixed_amount' && discount_value < 1) {
      return new Response(
        JSON.stringify({ error: 'Fixed amount discount must be at least 1' }),
        { headers: { ...headers, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate max_redemptions if provided
    if (max_redemptions !== undefined && !isPositiveInteger(max_redemptions)) {
      return new Response(
        JSON.stringify({ error: 'max_redemptions must be a positive integer' }),
        { headers: { ...headers, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate valid_until if provided
    if (valid_until !== undefined) {
      const validUntilDate = new Date(valid_until);
      if (isNaN(validUntilDate.getTime())) {
        return new Response(
          JSON.stringify({ error: 'valid_until must be a valid date' }),
          { headers: { ...headers, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      if (validUntilDate <= new Date()) {
        return new Response(
          JSON.stringify({ error: 'valid_until must be a future date' }),
          { headers: { ...headers, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    }

    console.log(`[ADMIN: ${maskEmail(user.email)}] Creating Stripe coupon:`, { code, discount_type, discount_value });

    // Create coupon in Stripe
    const couponParams: Stripe.CouponCreateParams = {
      name: code,
      currency: discount_type === 'fixed_amount' ? 'mxn' : undefined,
    };

    if (discount_type === 'percentage') {
      couponParams.percent_off = discount_value;
    } else {
      couponParams.amount_off = discount_value;
    }

    if (valid_until) {
      couponParams.redeem_by = Math.floor(new Date(valid_until).getTime() / 1000);
    }

    const coupon = await stripe.coupons.create(couponParams);
    console.log('Stripe coupon created:', coupon.id);

    // Create promotion code in Stripe
    const promotionCodeParams: Stripe.PromotionCodeCreateParams = {
      coupon: coupon.id,
      code: code,
    };

    if (max_redemptions) {
      promotionCodeParams.max_redemptions = max_redemptions;
    }

    const promotionCode = await stripe.promotionCodes.create(promotionCodeParams);
    console.log('Stripe promotion code created:', promotionCode.id);

    // Log admin action for audit trail
    await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: user.id,
      action: 'create_coupon',
      details: {
        code,
        discount_type,
        discount_value,
        max_redemptions,
        valid_until,
        stripe_coupon_id: coupon.id,
        stripe_promotion_code_id: promotionCode.id,
      },
    }).then(({ error }) => {
      if (error) console.warn('Failed to log admin action:', error);
    });

    return new Response(
      JSON.stringify({
        success: true,
        coupon_id: coupon.id,
        promotion_code_id: promotionCode.id
      }),
      {
        headers: { ...headers, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error creating Stripe coupon:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
