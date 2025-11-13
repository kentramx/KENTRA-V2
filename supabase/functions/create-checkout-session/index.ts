import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';
// @deno-types="https://esm.sh/stripe@11.16.0/types/index.d.ts"
import Stripe from 'https://esm.sh/stripe@11.16.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
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

    // Verify user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { planId, billingCycle, successUrl, cancelUrl, upsells = [], upsellOnly = false } = await req.json();

    console.log('Creating checkout session for:', {
      userId: user.id,
      planId,
      billingCycle,
      upsellOnly,
    });

    // Si es compra de upsell únicamente
    if (upsellOnly) {
      console.log('Processing upsell-only purchase');
      
      // Verificar que el usuario tenga suscripción activa
      const { data: activeSub, error: subError } = await supabaseClient
        .from('user_subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (subError || !activeSub) {
        console.error('No active subscription:', subError);
        return new Response(
          JSON.stringify({ error: 'Necesitas una suscripción activa para comprar servicios adicionales' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const customerId = activeSub.stripe_customer_id;

      // Initialize Stripe
      const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
        apiVersion: '2023-10-16',
        httpClient: Stripe.createFetchHttpClient(),
      });

      // Line items solo con upsells
      const lineItems = upsells.map((upsell: any) => ({
        price: upsell.stripePriceId,
        quantity: 1,
      }));

      // Determinar mode según si hay recurrentes
      const hasRecurring = upsells.some((u: any) => u.isRecurring);
      const mode = hasRecurring ? 'subscription' : 'payment';

      console.log('Creating upsell checkout with line items:', lineItems, 'mode:', mode);

      // Crear sesión
      const session = await stripe.checkout.sessions.create({
        mode,
        payment_method_types: ['card'],
        customer: customerId,
        line_items: lineItems,
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: user.id,
        metadata: {
          user_id: user.id,
          upsell_only: 'true',
          upsell_ids: upsells.map((u: any) => u.id).join(','),
        },
      });

      console.log('Upsell checkout session created:', session.id);

      return new Response(
        JSON.stringify({ 
          checkoutUrl: session.url,
          sessionId: session.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get plan details (flujo normal con plan)
    const { data: plan, error: planError } = await supabaseClient
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      console.error('Plan error:', planError);
      return new Response(JSON.stringify({ error: 'Plan not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Determine price ID based on billing cycle
    const priceId = billingCycle === 'yearly' 
      ? plan.stripe_price_id_yearly 
      : plan.stripe_price_id_monthly;

    if (!priceId) {
      console.error('Missing price ID for billing cycle:', billingCycle);
      return new Response(
        JSON.stringify({ error: 'Price configuration missing for this billing cycle' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if customer already exists
    const { data: existingSubscription } = await supabaseClient
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let customerId = existingSubscription?.stripe_customer_id;

    // Create or retrieve customer
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          user_id: user.id,
        },
      });
      customerId = customer.id;
      console.log('Created new Stripe customer:', customerId);
    }

    // Build line items (plan + upsells)
    const lineItems = [
      {
        price: priceId,
        quantity: 1,
      },
      ...upsells.map((upsell: any) => ({
        price: upsell.stripePriceId,
        quantity: 1,
      })),
    ];

    // Determine mode: subscription if there are recurring items, payment for one-time only
    const hasRecurring = true; // Plan is always recurring
    const mode = hasRecurring ? 'subscription' : 'payment';

    console.log('Creating checkout with line items:', lineItems);

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode,
      payment_method_types: ['card'],
      customer: customerId,
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: user.id,
      metadata: {
        plan_id: planId,
        user_id: user.id,
        billing_cycle: billingCycle,
        has_upsells: upsells.length > 0 ? 'true' : 'false',
      },
      ...(mode === 'subscription' ? {
        subscription_data: {
          metadata: {
            plan_id: planId,
            user_id: user.id,
          },
        },
      } : {}),
    });

    console.log('Checkout session created:', session.id);

    return new Response(
      JSON.stringify({ 
        checkoutUrl: session.url,
        sessionId: session.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
