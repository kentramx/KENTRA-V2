/**
 * CRON JOB: Expirar pagos pendientes OXXO/SPEI después de 48 horas
 * 
 * Este job corre cada 4 horas y expira suscripciones con status='incomplete'
 * que llevan más de 48 horas sin completar el pago.
 * 
 * Típico para pagos OXXO (efectivo) y SPEI (transferencia) que requieren
 * confirmación manual y pueden no completarse nunca.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { MAX_PENDING_PAYMENT_HOURS } from '../_shared/subscriptionStates.ts';
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, getClientIP, rateLimitedResponse, apiRateLimit } from "../_shared/rateLimit.ts";

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
});

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
    console.log('🔄 Starting expire-incomplete-payments job...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Calcular fecha límite (MAX_PENDING_PAYMENT_HOURS horas atrás)
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - MAX_PENDING_PAYMENT_HOURS);
    const cutoffISO = cutoffDate.toISOString();

    console.log(`Looking for incomplete subscriptions created before: ${cutoffISO}`);

    // Buscar suscripciones incompletas que excedan el tiempo límite
    const { data: expiredSubs, error: fetchError } = await supabaseClient
      .from('user_subscriptions')
      .select('id, user_id, created_at, stripe_subscription_id, plan_id, subscription_plans(display_name)')
      .eq('status', 'incomplete')
      .lt('created_at', cutoffISO);

    if (fetchError) {
      console.error('Error fetching incomplete subscriptions:', fetchError);
      throw fetchError;
    }

    if (!expiredSubs || expiredSubs.length === 0) {
      console.log('✅ No incomplete subscriptions to expire');
      return new Response(
        JSON.stringify({ success: true, expired: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${expiredSubs.length} incomplete subscriptions to expire`);

    let expiredCount = 0;
    let errorCount = 0;
    let stripeCanceledCount = 0;

    for (const sub of expiredSubs) {
      try {
        // 1. Cancel Stripe subscription if exists
        if (sub.stripe_subscription_id) {
          try {
            const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
            if (stripeSub.status === 'incomplete' || stripeSub.status === 'incomplete_expired') {
              await stripe.subscriptions.cancel(sub.stripe_subscription_id);
              stripeCanceledCount++;
              console.log(`Canceled Stripe subscription ${sub.stripe_subscription_id}`);
            }
          } catch (stripeError) {
            console.warn(`Could not cancel Stripe subscription ${sub.stripe_subscription_id}:`, stripeError);
            // Continue even if Stripe cancellation fails
          }
        }

        // 2. Marcar como expirada en la base de datos
        const { error: updateError } = await supabaseClient
          .from('user_subscriptions')
          .update({
            status: 'expired',
            updated_at: new Date().toISOString(),
            metadata: {
              expired_reason: 'payment_timeout',
              expired_at: new Date().toISOString(),
              max_pending_hours: MAX_PENDING_PAYMENT_HOURS,
              payment_method: 'oxxo_spei',
            },
          })
          .eq('id', sub.id);

        if (updateError) {
          console.error(`Error expiring subscription ${sub.id}:`, updateError);
          errorCount++;
          continue;
        }

        // 3. Record in payment history for audit trail
        await supabaseClient
          .from('payment_history')
          .insert({
            user_id: sub.user_id,
            amount: 0,
            currency: 'MXN',
            status: 'expired',
            description: 'Pago pendiente OXXO/SPEI expirado',
            metadata: {
              subscription_id: sub.id,
              plan_id: sub.plan_id,
              max_pending_hours: MAX_PENDING_PAYMENT_HOURS,
              stripe_subscription_id: sub.stripe_subscription_id,
            },
          });

        // 4. Enviar notificación al usuario
        try {
          await supabaseClient.functions.invoke('send-subscription-notification', {
            body: {
              userId: sub.user_id,
              type: 'payment_expired',
              metadata: {
                planName: (sub.subscription_plans as any)?.display_name || 'Tu plan',
                reason: 'El tiempo para completar tu pago ha expirado',
                hours: MAX_PENDING_PAYMENT_HOURS,
              },
            },
          });
        } catch (notifyError) {
          console.error(`Error sending expiry notification for ${sub.id}:`, notifyError);
          // No bloqueamos si falla la notificación
        }

        expiredCount++;
        console.log(`Expired subscription ${sub.id} for user ${sub.user_id}`);
      } catch (error) {
        console.error(`Error processing subscription ${sub.id}:`, error);
        errorCount++;
      }
    }

    console.log(`✅ Job complete: ${expiredCount} expired, ${stripeCanceledCount} Stripe canceled, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        expired: expiredCount,
        stripeCanceled: stripeCanceledCount,
        errors: errorCount,
        cutoffDate: cutoffISO,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error in expire-incomplete-payments:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
