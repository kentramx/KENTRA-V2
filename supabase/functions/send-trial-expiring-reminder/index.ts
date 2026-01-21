import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, getClientIP, rateLimitedResponse, apiRateLimit } from "../_shared/rateLimit.ts";

/**
 * Cron job que envía recordatorio 2 días antes de que expire el trial
 * Debe ejecutarse diariamente
 */
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
    console.log('Starting trial expiring reminder check...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Buscar trials activos que expiran en exactamente 2 días
    // Trial dura 14 días, así que buscamos los creados hace 12 días
    const twelveDaysAgo = new Date();
    twelveDaysAgo.setDate(twelveDaysAgo.getDate() - 12);
    
    const thirteenDaysAgo = new Date();
    thirteenDaysAgo.setDate(thirteenDaysAgo.getDate() - 13);

    const { data: expiringTrials, error: trialsError } = await supabaseClient
      .from('user_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('status', 'active')
      .eq('subscription_plans.name', 'agente_trial')
      .gte('created_at', thirteenDaysAgo.toISOString())
      .lt('created_at', twelveDaysAgo.toISOString());

    if (trialsError) {
      console.error('Error fetching expiring trials:', trialsError);
      throw trialsError;
    }

    if (!expiringTrials || expiringTrials.length === 0) {
      console.log('No trials expiring in 2 days');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No trials expiring soon',
          reminders: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${expiringTrials.length} trial(s) expiring in 2 days`);

    let remindersSent = 0;

    for (const trial of expiringTrials) {
      try {
        // Calcular fecha de expiración (14 días desde created_at)
        const createdAt = new Date(trial.created_at);
        const expiryDate = new Date(createdAt);
        expiryDate.setDate(expiryDate.getDate() + 14);

        console.log(`Sending reminder to user ${trial.user_id}, expires: ${expiryDate.toISOString()}`);

        await supabaseClient.functions.invoke('send-subscription-notification', {
          body: {
            userId: trial.user_id,
            type: 'trial_expiring',
            metadata: {
              daysRemaining: 2,
              expiryDate: expiryDate.toLocaleDateString('es-MX', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              }),
            },
          },
        });

        remindersSent++;
        console.log(`Reminder sent to user ${trial.user_id}`);
      } catch (notifError) {
        console.error(`Error sending reminder to user ${trial.user_id}:`, notifError);
      }
    }

    console.log('Trial expiring reminder check completed:', { remindersSent });

    return new Response(
      JSON.stringify({
        success: true,
        reminders: remindersSent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in send-trial-expiring-reminder:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
