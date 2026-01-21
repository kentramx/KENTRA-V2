import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';
// @deno-types="https://esm.sh/stripe@11.16.0/types/index.d.ts"
import Stripe from 'https://esm.sh/stripe@11.16.0?target=deno';
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, getClientIP, rateLimitedResponse, apiRateLimit } from "../_shared/rateLimit.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

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
    console.log('Starting daily subscription sync...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Get all active and trialing subscriptions
    const { data: subscriptions, error: subError } = await supabaseClient
      .from('user_subscriptions')
      .select('*')
      .in('status', ['active', 'trialing']);

    if (subError) {
      throw subError;
    }

    let syncedCount = 0;
    let expiredCount = 0;
    let errorCount = 0;

    for (const sub of subscriptions || []) {
      try {
        if (!sub.stripe_subscription_id) {
          console.log(`Skipping subscription ${sub.id} - no Stripe ID`);
          continue;
        }

        // Fetch from Stripe
        const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);

        // Check if subscription should be expired
        const now = Math.floor(Date.now() / 1000);
        if (stripeSub.status === 'canceled' || (stripeSub.cancel_at && stripeSub.cancel_at < now)) {
          console.log(`Expiring subscription ${sub.id} for user ${sub.user_id}`);
          
          // Update to canceled status
          await supabaseClient
            .from('user_subscriptions')
            .update({
              status: 'canceled',
              cancel_at_period_end: false,
              updated_at: new Date().toISOString(),
            })
            .eq('id', sub.id);

          // Pause all properties for this user
          await supabaseClient
            .from('properties')
            .update({ status: 'pausada' })
            .eq('agent_id', sub.user_id)
            .eq('status', 'activa');

          expiredCount++;
        } else {
          // === SINCRONIZACIÓN COMPLETA ===
          // Extraer billing_cycle del precio actual
          const priceId = stripeSub.items?.data?.[0]?.price?.id;
          const priceInterval = stripeSub.items?.data?.[0]?.price?.recurring?.interval;
          const newBillingCycle = priceInterval === 'year' ? 'yearly' : 'monthly';
          
          // Buscar plan_id desde el priceId en la base de datos
          let newPlanId = sub.plan_id;
          if (priceId) {
            const { data: matchingPlan } = await supabaseClient
              .from('subscription_plans')
              .select('id')
              .or(`stripe_price_id_monthly.eq.${priceId},stripe_price_id_yearly.eq.${priceId}`)
              .maybeSingle();
            
            if (matchingPlan) {
              newPlanId = matchingPlan.id;
            }
          }
          
          // Calcular nuevos valores de período
          const newPeriodStart = new Date(stripeSub.current_period_start * 1000).toISOString();
          const newPeriodEnd = new Date(stripeSub.current_period_end * 1000).toISOString();
          
          // Verificar si hay cambios
          const needsUpdate = 
            stripeSub.status !== sub.status || 
            stripeSub.cancel_at_period_end !== sub.cancel_at_period_end ||
            newPlanId !== sub.plan_id ||
            newBillingCycle !== sub.billing_cycle ||
            newPeriodStart !== sub.current_period_start ||
            newPeriodEnd !== sub.current_period_end;

          if (needsUpdate) {
            console.log(`Syncing subscription ${sub.id}:`, {
              status: `${sub.status} -> ${stripeSub.status}`,
              cancel_at_period_end: `${sub.cancel_at_period_end} -> ${stripeSub.cancel_at_period_end}`,
              plan_id: `${sub.plan_id} -> ${newPlanId}`,
              billing_cycle: `${sub.billing_cycle} -> ${newBillingCycle}`,
              period_end: `${sub.current_period_end} -> ${newPeriodEnd}`,
            });
            
            await supabaseClient
              .from('user_subscriptions')
              .update({
                status: stripeSub.status,
                cancel_at_period_end: stripeSub.cancel_at_period_end,
                plan_id: newPlanId,
                billing_cycle: newBillingCycle,
                current_period_start: newPeriodStart,
                current_period_end: newPeriodEnd,
                updated_at: new Date().toISOString(),
              })
              .eq('id', sub.id);
          }
          syncedCount++;
        }
      } catch (error) {
        console.error(`Error syncing subscription ${sub.id}:`, error);
        errorCount++;
      }
    }

    console.log('Sync complete:', { syncedCount, expiredCount, errorCount });

    return new Response(
      JSON.stringify({
        success: true,
        synced: syncedCount,
        expired: expiredCount,
        errors: errorCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error syncing subscriptions:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
