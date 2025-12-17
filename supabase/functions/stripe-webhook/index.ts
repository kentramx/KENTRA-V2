import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';
// @deno-types="https://esm.sh/stripe@11.16.0/types/index.d.ts"
import Stripe from 'https://esm.sh/stripe@11.16.0?target=deno';
import { createLogger } from '../_shared/logger.ts';
import { withSentry, captureException } from '../_shared/sentry.ts';

// ============================================================================
// CONSTANTES DE ESTADOS DE SUSCRIPCIÓN
// TODO: Mover a _shared/subscriptionStates.ts cuando se necesite reutilizar
// ============================================================================
const SUBSCRIPTION_STATUSES = {
  ACTIVE: 'active',
  TRIALING: 'trialing',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
  INCOMPLETE: 'incomplete',
  SUSPENDED: 'suspended',
  EXPIRED: 'expired',
} as const;

// Estados operativos (usuario puede usar el servicio)
const OPERATIONAL_STATUSES = [SUBSCRIPTION_STATUSES.ACTIVE, SUBSCRIPTION_STATUSES.TRIALING];

// Estados que requieren acción del usuario
const REQUIRES_ACTION_STATUSES = [SUBSCRIPTION_STATUSES.PAST_DUE, SUBSCRIPTION_STATUSES.INCOMPLETE];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(withSentry(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const logger = createLogger('stripe-webhook', { requestId });
  const startTime = Date.now();
  
  // Log de inicio con request ID para trazabilidad
  logger.info('Webhook request received', { 
    method: req.method,
    url: req.url,
    userAgent: req.headers.get('user-agent')?.slice(0, 50),
  });

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
      logger.warn('Missing stripe-signature header');
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
      logger.error('Webhook signature verification failed', { error: errorMessage });
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logger.info('Webhook event received', { stripeEventId: event.id, action: event.type });

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

          // === ASIGNAR ROL DE AGENTE SI ES PLAN DE AGENTE ===
          const { data: planInfo } = await supabaseClient
            .from('subscription_plans')
            .select('name')
            .eq('id', planId)
            .single();

          if (planInfo?.name?.startsWith('agente_') || planInfo?.name?.startsWith('inmobiliaria_') || planInfo?.name?.startsWith('desarrolladora_')) {
            // Determinar el rol según el tipo de plan
            let targetRole: 'agent' | 'agency' | 'developer' = 'agent';
            if (planInfo.name.startsWith('inmobiliaria_')) {
              targetRole = 'agency';
            } else if (planInfo.name.startsWith('desarrolladora_')) {
              targetRole = 'developer';
            }

            // Verificar si ya tiene el rol
            const { data: existingRole } = await supabaseClient
              .from('user_roles')
              .select('id')
              .eq('user_id', userId)
              .eq('role', targetRole)
              .maybeSingle();

            if (!existingRole) {
              const { error: roleError } = await supabaseClient
                .from('user_roles')
                .insert({
                  user_id: userId,
                  role: targetRole,
                });

              if (roleError) {
                console.error(`Error assigning ${targetRole} role:`, roleError);
              } else {
                console.log(`${targetRole} role assigned to user:`, userId);
              }
            } else {
              console.log(`User ${userId} already has ${targetRole} role`);
            }
          }

          // === REGISTRAR REDENCIÓN DE CUPÓN SI APLICA ===
          const couponCode = session.metadata?.coupon_code;
          if (couponCode) {
            console.log('Processing coupon redemption for:', couponCode);
            
            // Obtener datos del cupón
            const { data: couponData, error: couponError } = await supabaseClient
              .from('promotion_coupons')
              .select('id, discount_value, currency')
              .eq('code', couponCode)
              .single();

            if (couponError) {
              console.error('Error fetching coupon:', couponError);
            } else if (couponData) {
              // Insertar registro de redención
              const { error: redemptionError } = await supabaseClient
                .from('coupon_redemptions')
                .insert({
                  coupon_id: couponData.id,
                  user_id: userId,
                  stripe_session_id: session.id,
                  discount_amount: couponData.discount_value,
                  currency: couponData.currency || 'mxn',
                  plan_id: planId,
                });

              if (redemptionError) {
                console.error('Error recording coupon redemption:', redemptionError);
              } else {
                console.log('Coupon redemption recorded successfully');
                
                // Incrementar contador de usos
                const { error: incrementError } = await supabaseClient.rpc('increment_coupon_uses', {
                  p_code: couponCode,
                });

                if (incrementError) {
                  console.error('Error incrementing coupon uses:', incrementError);
                } else {
                  console.log('Coupon uses incremented for:', couponCode);
                }
              }
            }
          }

          // === ENVIAR EMAIL DE BIENVENIDA (PAGO) ===
          // Obtener detalles del plan para el email
          const { data: planDetails } = await supabaseClient
            .from('subscription_plans')
            .select('display_name, features')
            .eq('id', planId)
            .single();

          if (planDetails) {
            const features = planDetails.features as Record<string, any>;
            await supabaseClient.functions.invoke('send-subscription-notification', {
              body: {
                userId: userId,
                type: 'welcome_paid',
                metadata: {
                  planName: planDetails.display_name,
                  maxProperties: features?.max_properties || 'ilimitadas',
                  featuredPerMonth: features?.featured_per_month || 0,
                  nextBillingDate: new Date(periodEnd).toLocaleDateString('es-MX', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  }),
                },
              },
            });
            console.log('Welcome email sent to user:', userId);
          }
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

      case 'invoice.payment_succeeded':
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`Invoice ${event.type}:`, invoice.id, 'billing_reason:', invoice.billing_reason);

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

        // 🔧 FIX: Detectar tipo de factura para registro correcto
        const isProration = invoice.billing_reason === 'subscription_update';
        const isRenewal = invoice.billing_reason === 'subscription_cycle';
        const isFirstPayment = invoice.billing_reason === 'subscription_create';
        
        const paymentType = isProration ? 'proration' 
          : isRenewal ? 'renewal' 
          : isFirstPayment ? 'subscription'
          : 'subscription';

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
            payment_type: paymentType,
            metadata: {
              invoice_id: invoice.id,
              billing_reason: invoice.billing_reason,
              is_proration: isProration,
            },
          });

        if (paymentError) {
          console.error('Error recording payment:', paymentError);
        } else {
          console.log(`Payment recorded successfully (${paymentType})`);
        }

        // 🔧 FIX: Sincronizar fechas de período desde la suscripción actualizada
        if (subscription.current_period_start && subscription.current_period_end) {
          await supabaseClient
            .from('user_subscriptions')
            .update({
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            })
            .eq('id', subRecord.id);
          console.log('Synced subscription period dates from Stripe');
        }

        // Send renewal success notification (only for renewals, not prorations)
        if (!isProration) {
          await supabaseClient.functions.invoke('send-subscription-notification', {
            body: {
              userId: subRecord.user_id,
              type: 'renewal_success',
              metadata: {
                planName: subRecord.subscription_plans.display_name,
                amount: (invoice.amount_paid / 100).toFixed(2),
                nextBillingDate: new Date(subscription.current_period_end * 1000).toLocaleDateString('es-MX', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                }),
              },
            },
          });
        } else {
          console.log('Proration payment processed - skipping renewal notification');
        }

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

        // Detectar si el precio/plan cambió externamente (desde Stripe Dashboard)
        const currentPriceId = subscription.items?.data[0]?.price?.id;
        let newPlanId: string | null = null;
        
        if (currentPriceId) {
          // Buscar plan por stripe_price_id
          const { data: matchedPlan } = await supabaseClient
            .from('subscription_plans')
            .select('id')
            .or(`stripe_price_id.eq.${currentPriceId},stripe_price_id_yearly.eq.${currentPriceId}`)
            .maybeSingle();
          
          if (matchedPlan) {
            newPlanId = matchedPlan.id;
            console.log('Detected plan change from Stripe, new plan_id:', newPlanId);
          }
        }

        // Detectar billing_cycle del precio actual
        let billingCycle: 'monthly' | 'yearly' = 'monthly';
        const priceInterval = subscription.items?.data[0]?.price?.recurring?.interval;
        if (priceInterval === 'year') {
          billingCycle = 'yearly';
        }

        // Update subscription status + plan_id si cambió
        const updateData: Record<string, unknown> = {
          status: subscription.status,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          cancel_at_period_end: subscription.cancel_at_period_end,
          billing_cycle: billingCycle,
        };
        
        if (newPlanId) {
          updateData.plan_id = newPlanId;
        }

        const { error: updateError } = await supabaseClient
          .from('user_subscriptions')
          .update(updateData)
          .eq('stripe_subscription_id', subscription.id);

        if (updateError) {
          console.error('Error updating subscription:', updateError);
        } else {
          console.log('Subscription updated successfully', newPlanId ? `with new plan_id: ${newPlanId}` : '');
        }

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Subscription deleted:', subscription.id);

        // Obtener datos de la suscripción para el email
        const { data: existingSub } = await supabaseClient
          .from('user_subscriptions')
          .select('user_id, subscription_plans(display_name)')
          .eq('stripe_subscription_id', subscription.id)
          .single();

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
          
          // Enviar email de confirmación de cancelación
          if (existingSub && existingSub.user_id) {
            try {
              await supabaseClient.functions.invoke('send-subscription-notification', {
                body: {
                  userId: existingSub.user_id,
                  type: 'subscription_canceled',
                  metadata: {
                    planName: (existingSub.subscription_plans as any)?.display_name || 'Tu plan',
                    endDate: new Date().toLocaleDateString('es-MX', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }),
                  },
                },
              });
              console.log('Cancellation confirmation email sent');
            } catch (emailError) {
              console.error('Error sending cancellation email:', emailError);
            }
          }
        }

        break;
      }

      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`📦 SUBSCRIPTION CREATED: ${subscription.id}`);
        
        // Buscar usuario por customer ID
        const { data: existingUser } = await supabaseClient
          .from('user_subscriptions')
          .select('id, user_id')
          .eq('stripe_customer_id', subscription.customer)
          .maybeSingle();

        // Si ya existe la suscripción (creada por checkout.session.completed), solo actualizar
        if (existingUser) {
          await supabaseClient
            .from('user_subscriptions')
            .update({
              stripe_subscription_id: subscription.id,
              status: subscription.status,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              cancel_at_period_end: subscription.cancel_at_period_end,
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_customer_id', subscription.customer);
          
          console.log(`Updated existing subscription for customer ${subscription.customer}`);
        } else {
          // MEJORADO: Intentar crear suscripción si tenemos user_id en metadata
          const userId = subscription.metadata?.user_id;
          if (userId) {
            console.log(`Creating subscription for user ${userId} from subscription.created event`);
            
            // Detectar plan_id desde el precio
            const priceId = subscription.items?.data[0]?.price?.id;
            let planId: string | null = null;
            
            if (priceId) {
              const { data: matchedPlan } = await supabaseClient
                .from('subscription_plans')
                .select('id')
                .or(`stripe_price_id_monthly.eq.${priceId},stripe_price_id_yearly.eq.${priceId}`)
                .maybeSingle();
              
              if (matchedPlan) {
                planId = matchedPlan.id;
              }
            }
            
            if (planId) {
              const billingCycle = subscription.items?.data[0]?.price?.recurring?.interval === 'year' ? 'yearly' : 'monthly';
              
              const { error: createError } = await supabaseClient
                .from('user_subscriptions')
                .upsert({
                  user_id: userId,
                  plan_id: planId,
                  stripe_subscription_id: subscription.id,
                  stripe_customer_id: subscription.customer as string,
                  status: subscription.status,
                  billing_cycle: billingCycle,
                  current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                  current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                  cancel_at_period_end: subscription.cancel_at_period_end,
                }, {
                  onConflict: 'user_id',
                });
              
              if (createError) {
                console.error('Error creating subscription from subscription.created:', createError);
              } else {
                console.log(`Subscription created for user ${userId} with plan ${planId}`);
              }
            } else {
              console.warn(`Could not find plan for price ${priceId}`);
            }
          } else {
            console.log(`No user_id in metadata for customer ${subscription.customer}, will be handled by checkout.session.completed`);
          }
        }
        
        break;
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute;
        console.log(`🚨 DISPUTA CREADA: ${dispute.id}`);

        // Buscar usuario por stripe_customer_id
        const { data: subscription } = await supabaseClient
          .from('user_subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', dispute.customer as string)
          .single();

        // Registrar disputa
        const { error: disputeError } = await supabaseClient
          .from('payment_disputes')
          .insert({
            user_id: subscription?.user_id || null,
            stripe_dispute_id: dispute.id,
            stripe_charge_id: dispute.charge as string,
            amount: dispute.amount,
            currency: dispute.currency,
            reason: dispute.reason,
            status: dispute.status,
          });

        if (disputeError) {
          console.error('Error registering dispute:', disputeError);
        } else {
          console.log('Dispute registered successfully');
        }

        // Notificar admin por email usando Resend
        const resendKey = Deno.env.get('RESEND_API_KEY');
        if (resendKey) {
          try {
            const emailResponse = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'Kentra Alertas <alertas@kentra.com.mx>',
                to: ['admin@kentra.com.mx'],
                subject: `🚨 DISPUTA: $${(dispute.amount / 100).toLocaleString('es-MX')} ${dispute.currency.toUpperCase()}`,
                html: `
                  <h2>Se ha creado una disputa</h2>
                  <p><strong>Monto:</strong> $${(dispute.amount / 100).toLocaleString('es-MX')} ${dispute.currency.toUpperCase()}</p>
                  <p><strong>Razón:</strong> ${dispute.reason}</p>
                  <p><strong>ID Disputa:</strong> ${dispute.id}</p>
                  <p><strong>Usuario:</strong> ${subscription?.user_id || 'No identificado'}</p>
                  <p><a href="https://dashboard.stripe.com/disputes/${dispute.id}">Ver en Stripe Dashboard</a></p>
                `,
              }),
            });
            
            if (!emailResponse.ok) {
              console.error('Error sending dispute email:', await emailResponse.text());
            } else {
              console.log('Dispute alert email sent successfully');
            }
          } catch (emailError) {
            console.error('Error sending dispute email:', emailError);
          }
        } else {
          console.warn('RESEND_API_KEY not configured, skipping email alert');
        }

        break;
      }

      case 'charge.dispute.closed': {
        const dispute = event.data.object as Stripe.Dispute;
        console.log(`✅ DISPUTA CERRADA: ${dispute.id}, Status: ${dispute.status}`);

        const { error: updateError } = await supabaseClient
          .from('payment_disputes')
          .update({
            status: dispute.status,
            closed_at: new Date().toISOString(),
          })
          .eq('stripe_dispute_id', dispute.id);

        if (updateError) {
          console.error('Error updating dispute:', updateError);
        } else {
          console.log('Dispute closed successfully');
        }

        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    logger.info('Webhook processed successfully', { stripeEventId: event.id, duration: Date.now() - startTime });

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('Error processing webhook', {}, error as Error);
    return new Response(
      JSON.stringify({ 
        error: 'Webhook processing error', 
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}));
