import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';
// @deno-types="https://esm.sh/stripe@11.16.0/types/index.d.ts"
import Stripe from 'https://esm.sh/stripe@11.16.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
          // Sync status and cancel_at_period_end
          const needsUpdate = 
            stripeSub.status !== sub.status || 
            stripeSub.cancel_at_period_end !== sub.cancel_at_period_end;

          if (needsUpdate) {
            console.log(`Syncing subscription ${sub.id}: status ${sub.status} -> ${stripeSub.status}, cancel_at_period_end ${sub.cancel_at_period_end} -> ${stripeSub.cancel_at_period_end}`);
            
            await supabaseClient
              .from('user_subscriptions')
              .update({
                status: stripeSub.status,
                cancel_at_period_end: stripeSub.cancel_at_period_end,
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
