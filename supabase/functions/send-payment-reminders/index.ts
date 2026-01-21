import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, getClientIP, rateLimitedResponse, apiRateLimit } from "../_shared/rateLimit.ts";

interface Subscription {
  id: string;
  user_id: string;
  status: string;
  metadata: {
    first_payment_failed_at?: string;
    payment_failure_count?: number;
  };
}

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
    console.log('Starting payment reminders cron job...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // Obtener todas las suscripciones en estado past_due
    const { data: pastDueSubs, error: subsError } = await supabaseClient
      .from('user_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('status', 'past_due')
      .returns<Subscription[]>();

    if (subsError) {
      console.error('Error fetching past_due subscriptions:', subsError);
      throw subsError;
    }

    if (!pastDueSubs || pastDueSubs.length === 0) {
      console.log('No past_due subscriptions found');
      return new Response(
        JSON.stringify({ message: 'No reminders to send', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${pastDueSubs.length} past_due subscriptions`);

    let remindersSent = 0;
    const now = new Date();

    // DUNNING MANAGEMENT: Enviar emails escalonados en días 3, 5, 7
    for (const sub of pastDueSubs) {
      const firstFailedAt = sub.metadata?.first_payment_failed_at;
      
      if (!firstFailedAt) {
        console.log(`Subscription ${sub.id} missing first_payment_failed_at`);
        continue;
      }

      const failedDate = new Date(firstFailedAt);
      const daysSinceFailed = Math.floor((now.getTime() - failedDate.getTime()) / (1000 * 60 * 60 * 24));

      console.log(`Subscription ${sub.id}: ${daysSinceFailed} days since payment failed`);

      // Determinar qué email enviar según días transcurridos
      let reminderType: 'payment_failed_day_3' | 'payment_failed_day_5' | 'payment_failed_day_7' | null = null;

      if (daysSinceFailed === 3) {
        reminderType = 'payment_failed_day_3';
      } else if (daysSinceFailed === 5) {
        reminderType = 'payment_failed_day_5';
      } else if (daysSinceFailed === 7) {
        reminderType = 'payment_failed_day_7';
      }

      if (!reminderType) {
        console.log(`No reminder needed for subscription ${sub.id} at day ${daysSinceFailed}`);
        continue;
      }

      // Enviar email de recordatorio
      console.log(`Sending ${reminderType} reminder for subscription ${sub.id}`);

      const { error: emailError } = await supabaseClient.functions.invoke(
        'send-subscription-notification',
        {
          body: {
            userId: sub.user_id,
            type: reminderType,
            metadata: {
              planName: (sub as any).subscription_plans?.display_name || 'tu plan',
              daysSinceFailed,
              daysRemaining: 7 - daysSinceFailed,
            },
          },
        }
      );

      if (emailError) {
        console.error(`Error sending ${reminderType} email for subscription ${sub.id}:`, emailError);
      } else {
        remindersSent++;
        console.log(`✅ Sent ${reminderType} reminder for subscription ${sub.id}`);
      }
    }

    console.log(`✅ Payment reminders cron job completed. Sent ${remindersSent} reminders.`);

    return new Response(
      JSON.stringify({ 
        message: 'Payment reminders sent successfully', 
        count: remindersSent,
        total_past_due: pastDueSubs.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in payment reminders cron job:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to send payment reminders', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
