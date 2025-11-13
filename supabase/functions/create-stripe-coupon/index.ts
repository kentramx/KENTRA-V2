import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    const { code, discount_type, discount_value, max_redemptions, valid_until } = await req.json();

    console.log('Creating Stripe coupon:', { code, discount_type, discount_value });

    // Crear cupón en Stripe
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

    // Crear promotion code en Stripe
    const promotionCodeParams: Stripe.PromotionCodeCreateParams = {
      coupon: coupon.id,
      code: code,
    };

    if (max_redemptions) {
      promotionCodeParams.max_redemptions = max_redemptions;
    }

    const promotionCode = await stripe.promotionCodes.create(promotionCodeParams);
    console.log('Stripe promotion code created:', promotionCode.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        coupon_id: coupon.id,
        promotion_code_id: promotionCode.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
