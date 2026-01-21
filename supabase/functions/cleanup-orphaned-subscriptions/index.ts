import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, getClientIP, rateLimitedResponse, apiRateLimit } from "../_shared/rateLimit.ts";

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting for API operations
  const clientIP = getClientIP(req);
  const rateResult = checkRateLimit(clientIP, apiRateLimit);
  if (!rateResult.allowed) {
    return rateLimitedResponse(rateResult, corsHeaders);
  }

  try {
    console.log('🧹 Starting cleanup-orphaned-subscriptions function');

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Initialize Stripe
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY no configurada');
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Find active/trialing subscriptions linked to non-existent plans
    console.log('🔍 Searching for orphaned subscriptions...');
    const { data: orphanedSubs, error: queryError } = await supabaseClient
      .from('user_subscriptions')
      .select(`
        id,
        user_id,
        plan_id,
        status,
        stripe_subscription_id,
        subscription_plans(id, name)
      `)
      .in('status', ['active', 'trialing']);

    if (queryError) {
      console.error('❌ Error querying subscriptions:', queryError);
      throw queryError;
    }

    console.log(`📊 Found ${orphanedSubs?.length || 0} active subscriptions to check`);

    // Filter subscriptions with null plans (orphaned)
    const orphaned = orphanedSubs?.filter((sub: any) => !sub.subscription_plans) || [];
    console.log(`⚠️ Found ${orphaned.length} orphaned subscriptions`);

    const results = {
      total: orphaned.length,
      processed: 0,
      errors: [] as any[],
    };

    // Process each orphaned subscription
    for (const sub of orphaned) {
      try {
        console.log(`🔄 Processing orphaned subscription: ${sub.id}`);

        // Cancel in Stripe if stripe_subscription_id exists
        if (sub.stripe_subscription_id) {
          try {
            console.log(`❌ Canceling Stripe subscription: ${sub.stripe_subscription_id}`);
            await stripe.subscriptions.cancel(sub.stripe_subscription_id);
            console.log(`✅ Stripe subscription canceled`);
          } catch (stripeError: any) {
            console.error(`⚠️ Error canceling Stripe subscription:`, stripeError.message);
            // Continue even if Stripe fails (might already be canceled)
          }
        }

        // Update subscription status in database
        const { error: updateError } = await supabaseClient
          .from('user_subscriptions')
          .update({
            status: 'canceled',
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sub.id);

        if (updateError) {
          console.error(`❌ Error updating subscription ${sub.id}:`, updateError);
          results.errors.push({ subscription_id: sub.id, error: updateError.message });
          continue;
        }

        console.log(`✅ Subscription ${sub.id} marked as canceled`);
        results.processed++;

        // TODO: Send email notification to user
        // This would require implementing an email service
        console.log(`📧 TODO: Send email to user ${sub.user_id} about discontinued plan`);
        
      } catch (error: any) {
        console.error(`❌ Error processing subscription ${sub.id}:`, error);
        results.errors.push({ subscription_id: sub.id, error: error.message });
      }
    }

    console.log('✅ Cleanup completed:', results);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cleanup completed',
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('❌ Error in cleanup-orphaned-subscriptions:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
