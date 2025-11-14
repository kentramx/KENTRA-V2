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

    console.log('Reactivating subscription for user:', user.id);

    // Get current subscription - buscar solo suscripciones activas
    const { data: subscription, error: subError } = await supabaseClient
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'No se encontró una suscripción activa para reactivar.' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!subscription.cancel_at_period_end) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Esta suscripción no tiene cancelación programada.' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!subscription.stripe_subscription_id) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'No se encontró ID de suscripción de Stripe.' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Get subscription from Stripe first to check real status
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripe_subscription_id
    );

    console.log('Stripe subscription status:', stripeSubscription.status);

    // Validación: No se puede reactivar si está cancelada, incompleta o expirada
    const nonReactivableStatuses = ['canceled', 'incomplete', 'incomplete_expired', 'unpaid'];
    if (nonReactivableStatuses.includes(stripeSubscription.status)) {
      // Sincronizar la BD con el estado real de Stripe
      const currentPeriodEnd = stripeSubscription.current_period_end 
        ? new Date(stripeSubscription.current_period_end * 1000).toISOString()
        : new Date().toISOString();

      await supabaseClient
        .from('user_subscriptions')
        .update({
          status: 'canceled',
          cancel_at_period_end: false,
          current_period_end: currentPeriodEnd,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('stripe_subscription_id', subscription.stripe_subscription_id);

      console.log('Subscription synced as canceled in database');

      return new Response(JSON.stringify({ 
        success: false,
        error: 'Esta suscripción ya está completamente cancelada. Debes contratar un nuevo plan.',
        code: 'SUBSCRIPTION_FULLY_CANCELED',
        status: 'canceled'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Solo se puede reactivar si está activa o trialing con cancel_at_period_end
    const reactivableStatuses = ['active', 'trialing'];
    if (!reactivableStatuses.includes(stripeSubscription.status) || !stripeSubscription.cancel_at_period_end) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Solo puedes reactivar suscripciones activas con cancelación programada.',
        code: 'CANNOT_REACTIVATE'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Reactivate subscription by removing cancellation
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      {
        cancel_at_period_end: false,
      }
    );

    console.log('Subscription reactivated in Stripe:', updatedSubscription.id);

    // Update database
    const { error: updateError } = await supabaseClient
      .from('user_subscriptions')
      .update({
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (updateError) {
      console.error('Database update error:', updateError);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Error al actualizar la base de datos.' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Subscription reactivated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Subscription reactivated successfully',
        nextBillingDate: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Error al reactivar la suscripción. Intenta de nuevo.',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
