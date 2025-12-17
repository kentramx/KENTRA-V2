import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';

/**
 * CONSTANTE CENTRALIZADA: Duración del período de prueba
 * MANTENER SINCRONIZADA CON: src/config/subscriptionBusinessRules.ts
 */
const TRIAL_DURATION_DAYS = 14;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting trial expiration check...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Buscar suscripciones trial que hayan expirado (current_period_end < now)
    const now = new Date().toISOString();

    const { data: expiredTrials, error: trialsError } = await supabaseClient
      .from('user_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('status', 'trialing')
      .lt('current_period_end', now);

    if (trialsError) {
      console.error('Error fetching expired trials:', trialsError);
      throw trialsError;
    }

    if (!expiredTrials || expiredTrials.length === 0) {
      console.log('No expired trials found');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No expired trials found',
          expired: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${expiredTrials.length} expired trial(s)`);

    let expiredCount = 0;
    let propertiesPausedCount = 0;
    let notificationsSent = 0;

    for (const trial of expiredTrials) {
      try {
        console.log(`Processing expired trial for user ${trial.user_id}`);

        // 1. Actualizar status de suscripción a 'expired'
        const { error: updateSubError } = await supabaseClient
          .from('user_subscriptions')
          .update({ 
            status: 'expired',
            updated_at: new Date().toISOString(),
          })
          .eq('id', trial.id);

        if (updateSubError) {
          console.error(`Error updating subscription ${trial.id}:`, updateSubError);
          continue;
        }

        // 2. Pausar todas las propiedades activas del usuario
        const { data: activeProperties, error: propsError } = await supabaseClient
          .from('properties')
          .select('id')
          .eq('agent_id', trial.user_id)
          .eq('status', 'activa');

        if (propsError) {
          console.error(`Error fetching properties for user ${trial.user_id}:`, propsError);
        } else if (activeProperties && activeProperties.length > 0) {
          const propertyIds = activeProperties.map(p => p.id);
          
          const { error: pauseError } = await supabaseClient
            .from('properties')
            .update({ status: 'pausada' })
            .in('id', propertyIds);

          if (pauseError) {
            console.error(`Error pausing properties for user ${trial.user_id}:`, pauseError);
          } else {
            propertiesPausedCount += propertyIds.length;
            console.log(`Paused ${propertyIds.length} properties for user ${trial.user_id}`);
          }
        }

        // 3. Enviar notificación de expiración
        try {
          await supabaseClient.functions.invoke('send-subscription-notification', {
            body: {
              userId: trial.user_id,
              type: 'trial_expired',
              metadata: {
                trialDays: TRIAL_DURATION_DAYS,
                expiredDate: new Date().toLocaleDateString('es-MX', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                }),
              },
            },
          });
          notificationsSent++;
          console.log(`Notification sent to user ${trial.user_id}`);
        } catch (notifError) {
          console.error(`Error sending notification to user ${trial.user_id}:`, notifError);
        }

        expiredCount++;
      } catch (error) {
        console.error(`Error processing trial ${trial.id}:`, error);
      }
    }

    console.log('Trial expiration check completed:', {
      expiredCount,
      propertiesPausedCount,
      notificationsSent,
    });

    return new Response(
      JSON.stringify({
        success: true,
        expired: expiredCount,
        propertiesPaused: propertiesPausedCount,
        notificationsSent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in expire-trial-subscriptions:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
