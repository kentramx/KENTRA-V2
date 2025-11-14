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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') ?? '' },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Canceling subscription for user:', user.id);

    // Get current subscription
    const { data: subscription, error: subError } = await supabaseClient
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing', 'canceled'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (subError || !subscription) {
      return new Response(JSON.stringify({ error: 'No subscription found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!subscription.stripe_subscription_id) {
      return new Response(JSON.stringify({ error: 'No Stripe subscription ID found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Retrieve subscription from Stripe to check current status
    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);

    // Check if already canceled in Stripe
    if (stripeSubscription.status === 'canceled' || stripeSubscription.status === 'incomplete_expired') {
      console.log('Subscription already canceled in Stripe, syncing database');

      const { error: dbError } = await supabaseClient
        .from('user_subscriptions')
        .update({
          status: 'canceled',
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      if (dbError) {
        console.error('Error syncing canceled subscription:', dbError);
      }

      return new Response(JSON.stringify({
        success: true,
        status: 'canceled',
        message: 'La suscripción ya estaba cancelada; se sincronizó el estado.'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only cancel if subscription is active or trialing
    if (stripeSubscription.status !== 'active' && stripeSubscription.status !== 'trialing') {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'La suscripción no está en un estado que permita cancelación.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cancel at period end (no immediate cancellation)
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      {
        cancel_at_period_end: true,
      }
    );

    // Update database
    const { error: updateError } = await supabaseClient
      .from('user_subscriptions')
      .update({
        cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id);

    if (updateError) {
      console.error('Database update error:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update database' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Subscription canceled successfully at period end');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Subscription will be canceled at the end of the current period',
        cancelAt: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error canceling subscription:', error);

    // Handle the specific case where subscription is already canceled
    const message = error?.raw?.message || error?.message || '';
    if (typeof message === 'string' && message.includes('A canceled subscription can only update its cancellation_details')) {
      console.log('Subscription already canceled in Stripe (caught in error handler), syncing database');

      try {
        // Create new Supabase client for error handler
        const supabaseErrorClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          {
            global: {
              headers: { Authorization: req.headers.get('Authorization') ?? '' },
            },
          }
        );

        // Get subscription from database to update it
        const { data: userAuth } = await supabaseErrorClient.auth.getUser();
        if (userAuth?.user) {
          const { data: subscription } = await supabaseErrorClient
            .from('user_subscriptions')
            .select('id')
            .eq('user_id', userAuth.user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (subscription) {
            const { error: dbError } = await supabaseErrorClient
              .from('user_subscriptions')
              .update({
                status: 'canceled',
                cancel_at_period_end: false,
                updated_at: new Date().toISOString(),
              })
              .eq('id', subscription.id);

            if (dbError) {
              console.error('Error syncing canceled subscription in error handler:', dbError);
            }
          }
        }

        return new Response(JSON.stringify({
          success: true,
          status: 'canceled',
          message: 'La suscripción ya estaba cancelada en Stripe; se sincronizó el estado.'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (syncError) {
        console.error('Error syncing in catch handler:', syncError);
      }
    }

    // Any other error is treated as internal error
    return new Response(
      JSON.stringify({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Ocurrió un error al cancelar la suscripción.',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
