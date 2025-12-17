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
    console.log('🔄 Reactivate subscription endpoint called');

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ No authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('❌ Authentication error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ User authenticated:', user.id);

    // Get user's subscription: with pending cancellation OR suspended status
    const { data: subscription, error: subError } = await supabaseClient
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .or('cancel_at_period_end.eq.true,status.eq.suspended')
      .single();

    if (subError || !subscription) {
      console.error('❌ No subscription eligible for reactivation found:', subError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No se encontró una suscripción con cancelación programada o suspendida',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📦 Subscription found in DB:', subscription.id, 'Status:', subscription.status);

    // Initialize Stripe
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      console.error('❌ STRIPE_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Error de configuración del servidor' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
    });

    // CRITICAL: First check the actual Stripe subscription status
    console.log('🔍 Checking Stripe subscription status:', subscription.stripe_subscription_id);
    let stripeSubscription;
    try {
      stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
      console.log('📊 Stripe subscription status:', stripeSubscription.status);
      console.log('📊 Stripe cancel_at_period_end:', stripeSubscription.cancel_at_period_end);
    } catch (error) {
      console.error('❌ Error retrieving Stripe subscription:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No se pudo verificar el estado de la suscripción en Stripe',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if subscription is already canceled in Stripe
    if (stripeSubscription.status === 'canceled') {
      console.error('❌ Subscription is already canceled in Stripe');
      
      // Sync DB to reflect reality
      await supabaseClient
        .from('user_subscriptions')
        .update({
          status: 'canceled',
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      return new Response(
        JSON.stringify({
          success: false,
          error: 'SUBSCRIPTION_ALREADY_CANCELED',
          message: 'Tu suscripción ya ha finalizado. Por favor contrata un nuevo plan para continuar.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if subscription is eligible for reactivation:
    // 1. Active/trialing with pending cancellation
    // 2. Past_due (can be reactivated after payment)
    // 3. Local status is 'suspended' (grace period expired but Stripe still active)
    const validStatuses = ['active', 'trialing', 'past_due'];
    const hasValidStripeStatus = validStatuses.includes(stripeSubscription.status);
    const hasPendingCancellation = stripeSubscription.cancel_at_period_end;
    const isLocallySuspended = subscription.status === 'suspended';
    
    // Allow reactivation if: pending cancellation OR locally suspended with valid Stripe status
    if (!hasValidStripeStatus || (!hasPendingCancellation && !isLocallySuspended)) {
      console.error('❌ Subscription not eligible for reactivation:', {
        stripeStatus: stripeSubscription.status,
        cancel_at_period_end: stripeSubscription.cancel_at_period_end,
        localStatus: subscription.status
      });
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Tu suscripción no es elegible para reactivación. Contacta soporte si crees que es un error.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update Stripe subscription to cancel the cancellation
    console.log('🔄 Reactivating Stripe subscription:', subscription.stripe_subscription_id);
    const updatedStripeSubscription = await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      {
        cancel_at_period_end: false,
      }
    );

    console.log('✅ Stripe subscription reactivated');

    // Update database - restore to active status if was suspended
    const updateData: Record<string, any> = {
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    };
    
    // If was suspended, restore to active status
    if (subscription.status === 'suspended') {
      updateData.status = 'active';
      console.log('📦 Restoring suspended subscription to active status');
    }
    
    const { error: updateError } = await supabaseClient
      .from('user_subscriptions')
      .update(updateData)
      .eq('id', subscription.id);

    if (updateError) {
      console.error('❌ Error updating database:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Error actualizando la base de datos' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Database updated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Suscripción reactivada exitosamente',
        subscription: {
          id: updatedStripeSubscription.id,
          current_period_end: new Date(updatedStripeSubscription.current_period_end * 1000).toISOString(),
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error in reactivate-subscription:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
