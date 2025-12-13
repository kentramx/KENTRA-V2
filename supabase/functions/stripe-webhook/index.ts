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
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const signature = req.headers.get('stripe-signature');
    const body = await req.text();

    if (!signature) {
      console.error('Missing stripe-signature header');
      return new Response(
        JSON.stringify({ error: 'Missing signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Webhook signature verification failed:', errorMessage);
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Webhook event received:', event.type);

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

    // === IDEMPOTENCIA: Verificar si ya procesamos este evento ===
    const { data: existingEvent, error: checkError } = await supabaseClient
      .from('stripe_webhook_events')
      .select('id')
      .eq('event_id', event.id)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking event idempotency:', checkError);
      // Continuar procesando si hay error en la verificación (fail open)
    }

    if (existingEvent) {
      console.log(`Event ${event.id} already processed, skipping`);
      return new Response(
        JSON.stringify({ received: true, skipped: true, reason: 'duplicate' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Registrar el evento ANTES de procesarlo para evitar race conditions
    const { error: insertError } = await supabaseClient
      .from('stripe_webhook_events')
      .insert({
        event_id: event.id,
        event_type: event.type,
        payload: event.data.object,
      });

    if (insertError) {
      // Si es error de duplicado (unique constraint), otro proceso ya lo está manejando
      if (insertError.code === '23505') {
        console.log(`Event ${event.id} being processed by another instance, skipping`);
        return new Response(
          JSON.stringify({ received: true, skipped: true, reason: 'concurrent' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.error('Error inserting event:', insertError);
      // Continuar procesando si hay otro tipo de error
    }

    console.log('Processing new webhook event:', event.type, event.id);
    // === FIN IDEMPOTENCIA ===

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Checkout completed:', session.id);

        const userId = session.metadata?.user_id;
        const isUpsellOnly = session.metadata?.upsell_only === 'true';

        if (!userId) {
          console.error('Missing user_id in checkout session metadata');
          break;
        }

        // Si es compra de upsell únicamente
        if (isUpsellOnly) {
          console.log('Processing upsell-only purchase');
          
          const upsellIds = session.metadata?.upsell_ids?.split(',') || [];
          
          if (upsellIds.length === 0) {
            console.error('No upsell IDs found in metadata');
            break;
          }

          // Obtener detalles de los upsells
          const { data: upsells, error: upsellsError } = await supabaseClient
            .from('upsells')
            .select('*')
            .in('id', upsellIds);

          if (upsellsError || !upsells) {
            console.error('Error fetching upsells:', upsellsError);
            break;
          }

          // Registrar cada upsell comprado
          for (const upsell of upsells) {
            const endDate = upsell.is_recurring 
              ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 días para recurrentes
              : null; // Sin fecha de fin para one-time (se gestiona por featured_properties)

            const { error: insertError } = await supabaseClient
              .from('user_active_upsells')
              .insert({
                user_id: userId,
                upsell_id: upsell.id,
                stripe_subscription_id: session.subscription as string || null,
                stripe_payment_intent_id: session.payment_intent as string || null,
                status: 'active',
                quantity: 1,
                start_date: new Date().toISOString(),
                end_date: endDate,
                auto_renew: upsell.is_recurring,
              });

            if (insertError) {
              console.error('Error inserting upsell:', insertError);
            } else {
              console.log('Upsell registered:', upsell.name);
            }
          }

          break;
        }

        // Flujo normal de suscripción (con plan)
        const planId = session.metadata?.plan_id;
        const billingCycle = session.metadata?.billing_cycle;

        if (!planId) {
          console.error('Missing plan_id in checkout session');
          break;
        }

        // Get subscription details
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );

        // Validate timestamps before converting
        const periodStart = subscription.current_period_start 
          ? new Date(subscription.current_period_start * 1000).toISOString()
          : new Date().toISOString();
        
        const periodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // Default: 30 días

        // Create or update subscription record
        const { error: subError } = await supabaseClient
          .from('user_subscriptions')
          .upsert({
            user_id: userId,
            plan_id: planId,
            stripe_subscription_id: subscription.id,
            stripe_customer_id: subscription.customer as string,
            status: 'active',
            billing_cycle: billingCycle || 'monthly',
            current_period_start: periodStart,
            current_period_end: periodEnd,
            cancel_at_period_end: false,
          }, {
            onConflict: 'user_id',
          });

        if (subError) {
          console.error('Error creating subscription:', subError);
        } else {
          console.log('Subscription created successfully for user:', userId);
        }

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Payment failed:', invoice.id);

        if (!invoice.subscription) {
          console.error('No subscription found in failed invoice');
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(
          invoice.subscription as string
        );

        const userId = subscription.metadata?.user_id;

        if (!userId) {
          console.error('Missing user_id in subscription metadata');
          break;
        }

        // Get subscription record with plan details
        const { data: subRecord } = await supabaseClient
          .from('user_subscriptions')
          .select('*, subscription_plans(*)')
          .eq('stripe_subscription_id', subscription.id)
          .single();

        if (subRecord) {
          // Update to past_due status with grace period tracking
          await supabaseClient
            .from('user_subscriptions')
            .update({ 
              status: 'past_due',
              metadata: {
                ...subRecord.metadata,
                first_payment_failed_at: subRecord.metadata?.first_payment_failed_at || new Date().toISOString(),
                payment_failure_count: (subRecord.metadata?.payment_failure_count || 0) + 1,
              }
            })
            .eq('id', subRecord.id);

          // Send failure notification
          await supabaseClient.functions.invoke('send-subscription-notification', {
            body: {
              userId: subRecord.user_id,
              type: 'payment_failed',
              metadata: {
                planName: subRecord.subscription_plans.display_name,
                amount: (invoice.amount_due / 100).toFixed(2),
                graceDaysRemaining: 7,
              },
            },
          });
        }

        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Payment succeeded:', invoice.id);

        // Verificar que exista subscription en el invoice
        if (!invoice.subscription) {
          console.error('No subscription found in invoice');
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(
          invoice.subscription as string
        );

        const userId = subscription.metadata?.user_id;

        if (!userId) {
          console.error('Missing user_id in subscription metadata');
          break;
        }

        // Get subscription record with plan details
        const { data: subRecord } = await supabaseClient
          .from('user_subscriptions')
          .select('*, subscription_plans(*)')
          .eq('stripe_subscription_id', subscription.id)
          .single();

        if (!subRecord) {
          console.error('Subscription record not found');
          break;
        }

        // Reactivate if was past_due
        if (subRecord.status === 'past_due') {
          await supabaseClient
            .from('user_subscriptions')
            .update({ status: 'active' })
            .eq('id', subRecord.id);
        }

        // Record payment
        const { error: paymentError } = await supabaseClient
          .from('payment_history')
          .insert({
            user_id: userId,
            subscription_id: subRecord.id,
            stripe_payment_intent_id: invoice.payment_intent as string,
            amount: invoice.amount_paid / 100, // Convert from cents
            currency: invoice.currency.toUpperCase(),
            status: 'succeeded',
            payment_type: 'subscription',
            metadata: {
              invoice_id: invoice.id,
              billing_reason: invoice.billing_reason,
            },
          });

        if (paymentError) {
          console.error('Error recording payment:', paymentError);
        } else {
          console.log('Payment recorded successfully');
        }

        // Send renewal success notification
        await supabaseClient.functions.invoke('send-subscription-notification', {
          body: {
            userId: subRecord.user_id,
            type: 'renewal_success',
            metadata: {
              planName: subRecord.subscription_plans.display_name,
              amount: (invoice.amount_paid / 100).toFixed(2),
              nextBillingDate: new Date(invoice.period_end * 1000).toLocaleDateString('es-MX', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              }),
            },
          },
        });

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Subscription updated:', subscription.id);

        const userId = subscription.metadata?.user_id;

        if (!userId) {
          console.error('Missing user_id in subscription metadata');
          break;
        }

        // Validate timestamps before converting
        const periodStart = subscription.current_period_start 
          ? new Date(subscription.current_period_start * 1000).toISOString()
          : new Date().toISOString();
        
        const periodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        // Update subscription status
        const { error: updateError } = await supabaseClient
          .from('user_subscriptions')
          .update({
            status: subscription.status,
            current_period_start: periodStart,
            current_period_end: periodEnd,
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq('stripe_subscription_id', subscription.id);

        if (updateError) {
          console.error('Error updating subscription:', updateError);
        } else {
          console.log('Subscription updated successfully');
        }

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Subscription deleted:', subscription.id);

        // Mark subscription as canceled
        const { error: cancelError } = await supabaseClient
          .from('user_subscriptions')
          .update({
            status: 'canceled',
          })
          .eq('stripe_subscription_id', subscription.id);

        if (cancelError) {
          console.error('Error canceling subscription:', cancelError);
        } else {
          console.log('Subscription canceled successfully');
        }

        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Webhook processing error', 
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
