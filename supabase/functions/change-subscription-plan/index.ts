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

    const { newPlanId, billingCycle, previewOnly } = await req.json();

    console.log('Changing subscription plan:', {
      userId: user.id,
      newPlanId,
      billingCycle,
      previewOnly: previewOnly || false,
    });

    // Get current subscription
    const { data: currentSub, error: subError } = await supabaseClient
      .from('user_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (subError || !currentSub) {
      console.error('Subscription error:', subError);
      return new Response(JSON.stringify({ error: 'No active subscription found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get new plan details
    const { data: newPlan, error: planError } = await supabaseClient
      .from('subscription_plans')
      .select('*')
      .eq('id', newPlanId)
      .single();

    if (planError || !newPlan) {
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

    // Determine new price ID
    const newPriceId = billingCycle === 'yearly' 
      ? newPlan.stripe_price_id_yearly 
      : newPlan.stripe_price_id_monthly;

    if (!newPriceId) {
      return new Response(
        JSON.stringify({ error: 'Price configuration missing for this billing cycle' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Stripe subscription
    const stripeSubscription = await stripe.subscriptions.retrieve(
      currentSub.stripe_subscription_id
    );

    // If preview only, calculate proration without applying changes
    if (previewOnly) {
      const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
        customer: currentSub.stripe_customer_id,
        subscription: currentSub.stripe_subscription_id,
        subscription_items: [{
          id: stripeSubscription.items.data[0].id,
          price: newPriceId,
        }],
        subscription_proration_behavior: 'create_prorations',
      });

      // Calculate current plan price for comparison
      const currentPlan = currentSub.subscription_plans;
      const currentPrice = currentSub.billing_cycle === 'yearly'
        ? Number(currentPlan.price_yearly)
        : Number(currentPlan.price_monthly);
      
      const newPrice = billingCycle === 'yearly'
        ? Number(newPlan.price_yearly)
        : Number(newPlan.price_monthly);

      const isUpgrade = newPrice > currentPrice;
      const isDowngrade = newPrice < currentPrice;

      console.log('Preview calculated:', {
        proratedAmount: upcomingInvoice.amount_due,
        isUpgrade,
        isDowngrade,
      });

      return new Response(
        JSON.stringify({ 
          preview: true,
          proratedAmount: upcomingInvoice.amount_due / 100, // Convert from cents
          proratedCurrency: upcomingInvoice.currency.toUpperCase(),
          isUpgrade,
          isDowngrade,
          currentPrice,
          newPrice,
          nextBillingDate: new Date(upcomingInvoice.period_end * 1000).toISOString(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Apply the subscription change
    const updatedSubscription = await stripe.subscriptions.update(
      currentSub.stripe_subscription_id,
      {
        items: [{
          id: stripeSubscription.items.data[0].id,
          price: newPriceId,
        }],
        proration_behavior: 'create_prorations',
        metadata: {
          plan_id: newPlanId,
          user_id: user.id,
          billing_cycle: billingCycle,
        },
      }
    );

    // Update database
    const { error: updateError } = await supabaseClient
      .from('user_subscriptions')
      .update({
        plan_id: newPlanId,
        billing_cycle: billingCycle,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (updateError) {
      console.error('Database update error:', updateError);
    }

    console.log('Subscription updated successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        subscription: updatedSubscription,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error changing subscription plan:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
