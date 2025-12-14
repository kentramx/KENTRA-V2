import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[send-renewal-reminder] Starting renewal reminder job');

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Calculate the date range: 3 days from now (24-hour window)
    const now = new Date();
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const fourDaysFromNow = new Date(now);
    fourDaysFromNow.setDate(fourDaysFromNow.getDate() + 4);

    console.log(`[send-renewal-reminder] Looking for subscriptions renewing between ${threeDaysFromNow.toISOString()} and ${fourDaysFromNow.toISOString()}`);

    // Find active subscriptions that renew in exactly 3 days
    // Exclude: trials, canceled subscriptions, subscriptions marked for cancellation
    const { data: subscriptions, error: subError } = await supabaseClient
      .from('user_subscriptions')
      .select(`
        id,
        user_id,
        plan_id,
        status,
        billing_cycle,
        current_period_end,
        cancel_at_period_end,
        subscription_plans!inner (
          name,
          display_name,
          price_monthly,
          price_yearly,
          currency
        )
      `)
      .eq('status', 'active')
      .eq('cancel_at_period_end', false)
      .gte('current_period_end', threeDaysFromNow.toISOString())
      .lt('current_period_end', fourDaysFromNow.toISOString());

    if (subError) {
      console.error('[send-renewal-reminder] Error fetching subscriptions:', subError);
      return new Response(JSON.stringify({ error: 'Failed to fetch subscriptions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[send-renewal-reminder] No subscriptions found for renewal reminder');
      return new Response(JSON.stringify({ success: true, remindersSent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[send-renewal-reminder] Found ${subscriptions.length} subscriptions to remind`);

    let remindersSent = 0;
    const errors: string[] = [];

    for (const sub of subscriptions) {
      try {
        // Skip trial plans
        const planName = (sub.subscription_plans as any)?.name;
        if (planName === 'agente_trial') {
          console.log(`[send-renewal-reminder] Skipping trial subscription for user ${sub.user_id}`);
          continue;
        }

        const plan = sub.subscription_plans as any;
        const amount = sub.billing_cycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
        const currency = plan.currency || 'MXN';
        const renewalDate = new Date(sub.current_period_end!).toLocaleDateString('es-MX', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        // Send notification
        const { error: notifError } = await supabaseClient.functions.invoke('send-subscription-notification', {
          body: {
            userId: sub.user_id,
            type: 'renewal_reminder',
            metadata: {
              planName: plan.display_name,
              amount: amount,
              currency: currency,
              renewalDate: renewalDate,
              billingCycle: sub.billing_cycle === 'yearly' ? 'anual' : 'mensual'
            }
          }
        });

        if (notifError) {
          console.error(`[send-renewal-reminder] Error sending notification for user ${sub.user_id}:`, notifError);
          errors.push(`User ${sub.user_id}: ${notifError.message}`);
        } else {
          console.log(`[send-renewal-reminder] Reminder sent to user ${sub.user_id} for plan ${plan.display_name}`);
          remindersSent++;
        }
      } catch (err) {
        console.error(`[send-renewal-reminder] Error processing subscription ${sub.id}:`, err);
        errors.push(`Subscription ${sub.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    console.log(`[send-renewal-reminder] Job completed. Reminders sent: ${remindersSent}, Errors: ${errors.length}`);

    return new Response(JSON.stringify({ 
      success: true, 
      remindersSent,
      totalSubscriptions: subscriptions.length,
      errors: errors.length > 0 ? errors : undefined
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[send-renewal-reminder] Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
