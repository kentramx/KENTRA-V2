import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';
import { GRACE_PERIOD_DAYS } from '../_shared/subscriptionStates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`Starting past_due suspension check (grace period: ${GRACE_PERIOD_DAYS} days)...`);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Buscar suscripciones past_due que tengan más de GRACE_PERIOD_DAYS días en ese estado
    const gracePeriodAgo = new Date();
    gracePeriodAgo.setDate(gracePeriodAgo.getDate() - GRACE_PERIOD_DAYS);

    const { data: pastDueSubs, error: subsError } = await supabaseClient
      .from('user_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('status', 'past_due');

    if (subsError) {
      console.error('Error fetching past_due subscriptions:', subsError);
      throw subsError;
    }

    if (!pastDueSubs || pastDueSubs.length === 0) {
      console.log('No past_due subscriptions found');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No past_due subscriptions to suspend',
          suspended: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let suspendedCount = 0;
    let propertiesPausedCount = 0;

    for (const sub of pastDueSubs) {
      try {
        // Verificar si ya pasaron 7 días desde el primer fallo
        const firstFailedAt = sub.metadata?.first_payment_failed_at;
        
        if (!firstFailedAt) {
          console.log(`Subscription ${sub.id} missing first_payment_failed_at, skipping`);
          continue;
        }

        const failedDate = new Date(firstFailedAt);
        const daysSinceFailed = Math.floor((Date.now() - failedDate.getTime()) / (1000 * 60 * 60 * 24));

        console.log(`Subscription ${sub.id}: ${daysSinceFailed} days since first failure`);

        if (daysSinceFailed >= GRACE_PERIOD_DAYS) {
          console.log(`Suspending subscription ${sub.id} for user ${sub.user_id} (exceeded ${GRACE_PERIOD_DAYS} days)`);

          // 1. Actualizar status a 'suspended'
          const { error: updateError } = await supabaseClient
            .from('user_subscriptions')
            .update({
              status: 'suspended',
              updated_at: new Date().toISOString(),
              metadata: {
                ...sub.metadata,
                suspended_at: new Date().toISOString(),
                suspension_reason: 'payment_failed_grace_period_expired',
              }
            })
            .eq('id', sub.id);

          if (updateError) {
            console.error(`Error updating subscription ${sub.id}:`, updateError);
            continue;
          }

          // 2. Pausar todas las propiedades activas del usuario
          const { data: activeProperties, error: propsError } = await supabaseClient
            .from('properties')
            .select('id')
            .eq('agent_id', sub.user_id)
            .eq('status', 'activa');

          if (propsError) {
            console.error(`Error fetching properties for user ${sub.user_id}:`, propsError);
          } else if (activeProperties && activeProperties.length > 0) {
            const propertyIds = activeProperties.map(p => p.id);

            const { error: pauseError } = await supabaseClient
              .from('properties')
              .update({ status: 'pausada' })
              .in('id', propertyIds);

            if (pauseError) {
              console.error(`Error pausing properties for user ${sub.user_id}:`, pauseError);
            } else {
              propertiesPausedCount += propertyIds.length;
              console.log(`Paused ${propertyIds.length} properties for user ${sub.user_id}`);
            }
          }

          // 3. Enviar notificación de suspensión
          try {
            await supabaseClient.functions.invoke('send-subscription-notification', {
              body: {
                userId: sub.user_id,
                type: 'subscription_suspended',
                metadata: {
                  planName: sub.subscription_plans.display_name,
                  daysPastDue: daysSinceFailed,
                  suspendedDate: new Date().toLocaleDateString('es-MX', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  }),
                },
              },
            });
            console.log(`Suspension notification sent to user ${sub.user_id}`);
          } catch (notifError) {
            console.error(`Error sending notification to user ${sub.user_id}:`, notifError);
          }

          suspendedCount++;
        } else {
          console.log(`Subscription ${sub.id} still in grace period (${GRACE_PERIOD_DAYS - daysSinceFailed} days remaining)`);
        }
      } catch (error) {
        console.error(`Error processing subscription ${sub.id}:`, error);
      }
    }

    console.log('Suspension check completed:', {
      suspendedCount,
      propertiesPausedCount,
    });

    return new Response(
      JSON.stringify({
        success: true,
        suspended: suspendedCount,
        propertiesPaused: propertiesPausedCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in suspend-past-due-subscriptions:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
