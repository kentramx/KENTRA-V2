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
import { MAX_PENDING_PAYMENT_HOURS } from '../_shared/subscriptionStates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
      .select('id, user_id, created_at, subscription_plans(display_name)')
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

    for (const sub of expiredSubs) {
      try {
        // Marcar como expirada
        const { error: updateError } = await supabaseClient
          .from('user_subscriptions')
          .update({
            status: 'expired',
            updated_at: new Date().toISOString(),
            metadata: {
              expired_reason: 'payment_timeout',
              expired_at: new Date().toISOString(),
              max_pending_hours: MAX_PENDING_PAYMENT_HOURS,
            },
          })
          .eq('id', sub.id);

        if (updateError) {
          console.error(`Error expiring subscription ${sub.id}:`, updateError);
          errorCount++;
          continue;
        }

        // Enviar notificación al usuario
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

    console.log(`✅ Job complete: ${expiredCount} expired, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        expired: expiredCount,
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
