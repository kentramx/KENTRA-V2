import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';
// @deno-types="https://esm.sh/stripe@11.16.0/types/index.d.ts"
import Stripe from 'https://esm.sh/stripe@11.16.0?target=deno';
import { createLogger } from '../_shared/logger.ts';
import { withSentry, captureException } from '../_shared/sentry.ts';
import { checkRateLimit, getClientIP, rateLimitedResponse, RateLimitConfig } from '../_shared/rateLimit.ts';

// Rate limit config for webhooks: 100 requests per minute per IP
// Generous to allow Stripe retries, but protects against abuse
const webhookRateLimit: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
  keyPrefix: 'stripe-webhook',
};

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

import { getCorsHeaders, corsHeaders } from '../_shared/cors.ts';
import { checkBodySize, bodySizeLimitResponse, BODY_SIZE_LIMITS } from '../_shared/validation.ts';
import { logAuditEvent, AuditEventType } from '../_shared/auditLog.ts';

// Note: Stripe webhooks come from Stripe servers, not browser origins
// We keep corsHeaders for compatibility but webhooks don't need CORS

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

  // SECURITY: Rate limiting to protect against DDoS
  const clientIP = getClientIP(req);
  const rateLimitResult = checkRateLimit(clientIP, webhookRateLimit);
  if (!rateLimitResult.allowed) {
    logger.warn('Rate limit exceeded', { clientIP, remaining: rateLimitResult.remaining });
    return rateLimitedResponse(rateLimitResult, corsHeaders);
  }

  try {
    // SECURITY: Check body size before reading (webhooks can be large but have limits)
    const bodySizeResult = await checkBodySize(req, BODY_SIZE_LIMITS.WEBHOOK);
    if (!bodySizeResult.allowed) {
      logger.warn('Request body too large', { size: bodySizeResult.size });
      return bodySizeLimitResponse(corsHeaders);
    }

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

    // === IDEMPOTENCIA ATÓMICA: INSERT-first pattern para evitar race conditions ===
    // Intentamos insertar primero - si falla con unique constraint, otro proceso ya lo maneja
    const { error: insertError } = await supabaseClient
      .from('stripe_webhook_events')
      .insert({
        event_id: event.id,
        event_type: event.type,
        payload: event.data.object,
        processed_at: null, // Will be set after successful processing
      });

    if (insertError) {
      // Si es error de duplicado (unique constraint), verificar estado del evento existente
      if (insertError.code === '23505') {
        // Consultar el evento existente para determinar si ya fue procesado
        const { data: existingEvent } = await supabaseClient
          .from('stripe_webhook_events')
          .select('id, processed_at, created_at')
          .eq('event_id', event.id)
          .single();

        if (existingEvent?.processed_at) {
          // Ya fue procesado exitosamente
          logger.info(`Event ${event.id} already processed at ${existingEvent.processed_at}, skipping`);
          return new Response(
            JSON.stringify({ received: true, skipped: true, reason: 'duplicate' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Existe pero no fue procesado - verificar si está en progreso
        if (existingEvent) {
          const createdAt = new Date(existingEvent.created_at).getTime();
          const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

          if (createdAt > fiveMinutesAgo) {
            // Evento reciente = probablemente en progreso por otra instancia
            logger.info(`Event ${event.id} in progress by another instance, skipping`);
            return new Response(
              JSON.stringify({ received: true, skipped: true, reason: 'in_progress' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Evento viejo sin procesar = falló antes, intentar reclamar con UPDATE atómico
          const { data: claimed } = await supabaseClient
            .from('stripe_webhook_events')
            .update({ created_at: new Date().toISOString() })
            .eq('event_id', event.id)
            .is('processed_at', null)
            .select('id')
            .single();

          if (!claimed) {
            // Otro proceso lo reclamó primero
            logger.info(`Event ${event.id} claimed by another instance, skipping`);
            return new Response(
              JSON.stringify({ received: true, skipped: true, reason: 'claimed' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          logger.warn(`Event ${event.id} reclaimed for retry after previous failure`);
        }
      } else {
        // FAIL-CLOSED: Any other insert error should reject the request
        logger.error('Failed to record webhook event - rejecting request', {
          error: insertError,
          errorCode: insertError.code,
          errorMessage: insertError.message
        });
        return new Response(
          JSON.stringify({ error: 'Failed to record event', retryable: true }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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

        // Map Stripe status to our status (handle edge cases)
        const stripeStatus = subscription.status;
        let dbStatus: string;
        switch (stripeStatus) {
          case 'active':
          case 'trialing':
            dbStatus = stripeStatus;
            break;
          case 'incomplete':
          case 'incomplete_expired':
            dbStatus = 'incomplete';
            break;
          case 'past_due':
            dbStatus = 'past_due';
            break;
          case 'canceled':
          case 'unpaid':
            dbStatus = 'canceled';
            break;
          default:
            logger.warn(`Unknown Stripe status: ${stripeStatus}, defaulting to 'active'`);
            dbStatus = 'active';
        }

        // Validate timestamps before converting - log warning if using fallback
        let periodStart: string;
        let periodEnd: string;

        if (subscription.current_period_start) {
          periodStart = new Date(subscription.current_period_start * 1000).toISOString();
        } else {
          logger.warn(`Missing current_period_start for subscription ${subscription.id}, using now()`);
          periodStart = new Date().toISOString();
        }

        if (subscription.current_period_end) {
          periodEnd = new Date(subscription.current_period_end * 1000).toISOString();
        } else {
          logger.warn(`Missing current_period_end for subscription ${subscription.id}, using +30 days`);
          periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        }

        // Create or update subscription record
        // First check if user already has a subscription
        const { data: existingSub } = await supabaseClient
          .from('user_subscriptions')
          .select('id, stripe_subscription_id')
          .eq('user_id', userId)
          .maybeSingle();

        if (existingSub && existingSub.stripe_subscription_id !== subscription.id) {
          // User has a DIFFERENT subscription - log warning but proceed
          // This could happen if user switches plans or has concurrent sessions
          logger.warn(`User ${userId} already has subscription ${existingSub.stripe_subscription_id}, replacing with ${subscription.id}`);
        }

        const { error: subError } = await supabaseClient
          .from('user_subscriptions')
          .upsert({
            user_id: userId,
            plan_id: planId,
            stripe_subscription_id: subscription.id,
            stripe_customer_id: subscription.customer as string,
            status: dbStatus, // Use actual Stripe status
            billing_cycle: billingCycle || 'monthly',
            current_period_start: periodStart,
            current_period_end: periodEnd,
            cancel_at_period_end: subscription.cancel_at_period_end || false,
          }, {
            onConflict: 'user_id',
          });

        if (subError) {
          console.error('Error creating subscription:', subError);
        } else {
          console.log('Subscription created successfully for user:', userId);

          // SECURITY: Audit log for subscription created
          await logAuditEvent({
            event_type: 'subscription.created' as AuditEventType,
            user_id: userId,
            ip_address: getClientIP(req),
            success: true,
            metadata: {
              plan_id: planId,
              stripe_subscription_id: subscription.id,
              billing_cycle: billingCycle,
              status: dbStatus,
            },
          }, supabaseClient);

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
            const features = planDetails.features as Record<string, unknown>;
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
        console.log('Payment failed:', invoice.id, 'Attempt:', invoice.attempt_count);

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
          const now = new Date();

          // Extract failure reason for categorization
          const failureReason = invoice.last_finalization_error?.message || 'Unknown';
          const failureCode = (invoice as any).last_payment_error?.decline_code ||
                             (invoice as any).last_payment_error?.code || 'unknown';

          // Categorize failure types
          const NON_RECOVERABLE_CODES = ['fraudulent', 'lost_card', 'stolen_card', 'pickup_card'];
          const REQUIRES_ACTION_CODES = ['authentication_required', 'card_not_supported'];
          const isNonRecoverable = NON_RECOVERABLE_CODES.includes(failureCode);
          const requiresUserAction = REQUIRES_ACTION_CODES.includes(failureCode) ||
                                    failureCode === 'card_declined' ||
                                    failureCode === 'expired_card';

          // Determine first failure timestamp with validation
          let firstFailedAt: Date;
          if (subRecord.metadata?.first_payment_failed_at) {
            const storedDate = new Date(subRecord.metadata.first_payment_failed_at);
            // Validate: stored date should be in the past and within last 30 days
            if (!isNaN(storedDate.getTime()) && storedDate < now &&
                now.getTime() - storedDate.getTime() < 30 * 24 * 60 * 60 * 1000) {
              firstFailedAt = storedDate;
            } else {
              logger.warn('Invalid first_payment_failed_at in metadata, resetting', {
                stored: subRecord.metadata.first_payment_failed_at,
                subscriptionId: subRecord.id
              });
              firstFailedAt = now;
            }
          } else {
            firstFailedAt = now;
          }

          const daysSinceFirstFailure = Math.floor((now.getTime() - firstFailedAt.getTime()) / (1000 * 60 * 60 * 24));
          const gracePeriodDays = 7;
          const graceDaysRemaining = Math.max(0, gracePeriodDays - daysSinceFirstFailure);
          const failureCount = (subRecord.metadata?.payment_failure_count || 0) + 1;

          // Determine if should suspend immediately
          const MAX_STRIPE_ATTEMPTS = 4; // Stripe typically retries 3-4 times
          const shouldSuspendImmediately = isNonRecoverable ||
                                           (invoice.attempt_count >= MAX_STRIPE_ATTEMPTS && !invoice.next_payment_attempt);

          // Determine target status
          let targetStatus: string;
          if (shouldSuspendImmediately) {
            targetStatus = 'suspended';
            logger.warn('Suspending immediately due to non-recoverable failure or max attempts', {
              failureCode,
              attemptCount: invoice.attempt_count,
              isNonRecoverable
            });
          } else {
            targetStatus = 'past_due';
          }

          // Update subscription status with enhanced tracking
          const { error: updateError } = await supabaseClient
            .from('user_subscriptions')
            .update({
              status: targetStatus,
              metadata: {
                ...subRecord.metadata,
                first_payment_failed_at: firstFailedAt.toISOString(),
                payment_failure_count: failureCount,
                last_payment_failed_at: now.toISOString(),
                stripe_attempt_count: invoice.attempt_count,
                grace_days_remaining: shouldSuspendImmediately ? 0 : graceDaysRemaining,
                next_retry_at: invoice.next_payment_attempt
                  ? new Date(invoice.next_payment_attempt * 1000).toISOString()
                  : null,
                failure_code: failureCode,
                failure_reason: failureReason,
                is_non_recoverable: isNonRecoverable,
                requires_user_action: requiresUserAction,
              }
            })
            .eq('id', subRecord.id);

          if (updateError) {
            console.error('Error updating subscription status:', updateError);
          }

          // Record in payment history
          await supabaseClient
            .from('payment_history')
            .insert({
              user_id: subRecord.user_id,
              stripe_payment_intent_id: invoice.payment_intent as string,
              amount: invoice.amount_due / 100,
              currency: invoice.currency.toUpperCase(),
              status: 'failed',
              description: `Intento de pago fallido #${failureCount}${isNonRecoverable ? ' (no recuperable)' : ''}`,
              metadata: {
                invoice_id: invoice.id,
                attempt_count: failureCount,
                stripe_attempt_count: invoice.attempt_count,
                failure_reason: failureReason,
                failure_code: failureCode,
                is_non_recoverable: isNonRecoverable,
              },
            });

          // Determine notification type based on failure severity
          let notificationType: string;
          if (shouldSuspendImmediately) {
            notificationType = 'subscription_suspended';
          } else if (failureCount === 1) {
            notificationType = 'payment_failed';
          } else if (graceDaysRemaining <= 2) {
            notificationType = 'payment_failed_urgent';
          } else {
            notificationType = 'payment_failed_retry';
          }

          // Send failure notification with retry info
          try {
            await supabaseClient.functions.invoke('send-subscription-notification', {
              body: {
                userId: subRecord.user_id,
                type: notificationType,
                metadata: {
                  planName: subRecord.subscription_plans.display_name,
                  amount: (invoice.amount_due / 100).toLocaleString('es-MX'),
                  currency: invoice.currency.toUpperCase(),
                  graceDaysRemaining,
                  failureCount,
                  nextRetryDate: invoice.next_payment_attempt
                    ? new Date(invoice.next_payment_attempt * 1000).toLocaleDateString('es-MX', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'No programado',
                  updatePaymentUrl: `${Deno.env.get('PUBLIC_URL') || 'https://kentra.com.mx'}/perfil?tab=billing`,
                },
              },
            });
          } catch (notifError) {
            console.error('Error sending payment failure notification:', notifError);
          }

          console.log(`Payment failure recorded: attempt ${failureCount}, ${graceDaysRemaining} grace days remaining`);
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

        // 🔧 FIX P0: Reactivar suscripción Y propiedades si estaba past_due o suspended
        const wasInactive = subRecord.status === 'past_due' || subRecord.status === 'suspended';

        if (wasInactive) {
          console.log(`🔄 Reactivating subscription from ${subRecord.status} to active`);

          // 1. Actualizar status de suscripción a active
          await supabaseClient
            .from('user_subscriptions')
            .update({
              status: 'active',
              // Limpiar metadata de fallo de pago
              metadata: {
                ...subRecord.metadata,
                payment_failure_count: 0,
                first_payment_failed_at: null,
                last_payment_failed_at: null,
                grace_days_remaining: null,
              },
            })
            .eq('id', subRecord.id);

          // 2. Reactivar propiedades pausadas por falta de pago
          // Solo reactivar hasta el límite del plan MENOS las ya activas
          const maxProperties = subRecord.subscription_plans?.features?.max_properties || 0;

          // SECURITY FIX: Contar propiedades activas primero para no exceder límite
          const { count: activeCount } = await supabaseClient
            .from('properties')
            .select('*', { count: 'exact', head: true })
            .eq('agent_id', userId)
            .eq('status', 'activa');

          const availableSlots = Math.max(0, maxProperties - (activeCount || 0));

          if (availableSlots > 0) {
            const { data: pausedProperties } = await supabaseClient
              .from('properties')
              .select('id')
              .eq('agent_id', userId)
              .eq('status', 'pausada')
              .order('created_at', { ascending: true })
              .limit(availableSlots); // Only reactivate up to available slots

            if (pausedProperties && pausedProperties.length > 0) {
              const propertyIds = pausedProperties.map(p => p.id);
              await supabaseClient
                .from('properties')
                .update({ status: 'activa' })
                .in('id', propertyIds);

              console.log(`✅ Reactivated ${propertyIds.length} properties (${availableSlots} slots available, ${activeCount} already active)`);
            }
          } else {
            console.log(`⚠️ No slots available for reactivation (${activeCount}/${maxProperties} active)`);
          }

          // 3. Enviar notificación de reactivación
          await supabaseClient.functions.invoke('send-subscription-notification', {
            body: {
              userId: subRecord.user_id,
              type: 'renewal_success',
              metadata: {
                planName: subRecord.subscription_plans?.display_name || 'Tu plan',
                amount: (invoice.amount_paid / 100).toFixed(2),
                nextBillingDate: new Date(subscription.current_period_end * 1000).toLocaleDateString('es-MX', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                }),
                wasReactivated: true,
                propertiesReactivated: pausedProperties?.length || 0,
              },
            },
          });

          console.log('📧 Sent reactivation notification');
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

        // Send renewal success notification (only for renewals, not prorations, and not if already sent for reactivation)
        if (!isProration && !wasInactive) {
          await supabaseClient.functions.invoke('send-subscription-notification', {
            body: {
              userId: subRecord.user_id,
              type: 'renewal_success',
              metadata: {
                planName: subRecord.subscription_plans?.display_name || 'Tu plan',
                amount: (invoice.amount_paid / 100).toFixed(2),
                nextBillingDate: new Date(subscription.current_period_end * 1000).toLocaleDateString('es-MX', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                }),
              },
            },
          });
        } else if (isProration) {
          console.log('Proration payment processed - skipping renewal notification');
        } else if (wasInactive) {
          console.log('Reactivation notification already sent - skipping duplicate');
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
          // Buscar plan por stripe_price_id (check both monthly and yearly)
          const { data: matchedPlan } = await supabaseClient
            .from('subscription_plans')
            .select('id, name')
            .or(`stripe_price_id.eq.${currentPriceId},stripe_price_id_yearly.eq.${currentPriceId}`)
            .maybeSingle();

          if (matchedPlan) {
            newPlanId = matchedPlan.id;
            console.log('Detected plan change from Stripe, new plan_id:', newPlanId, 'plan:', matchedPlan.name);
          } else {
            // 🚨 CRITICAL P0 FIX: Price in Stripe doesn't match any plan in DB - ALERT ADMIN!
            logger.error('STRIPE_DB_DESYNC: Stripe price_id not found in subscription_plans', {
              stripeSubscriptionId: subscription.id,
              stripePriceId: currentPriceId,
              userId: userId,
            });

            // Alert admin immediately
            await supabaseClient.functions.invoke('send-admin-alerts', {
              body: {
                type: 'stripe_db_desync',
                severity: 'critical',
                message: `Stripe price_id no existe en DB: ${currentPriceId}`,
                details: {
                  stripeSubscriptionId: subscription.id,
                  stripePriceId: currentPriceId,
                  userId: userId,
                  action_required: 'Verificar si el precio existe en subscription_plans o si el plan fue eliminado',
                },
              },
            });

            // Also log to admin_audit_log for tracking
            await supabaseClient
              .from('admin_audit_log')
              .insert({
                action: 'stripe_db_desync_detected',
                details: {
                  stripe_subscription_id: subscription.id,
                  stripe_price_id: currentPriceId,
                  user_id: userId,
                  detected_at: new Date().toISOString(),
                },
              });
          }
        } else {
          logger.warn('No price_id found in subscription items', {
            stripeSubscriptionId: subscription.id,
          });
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

          // SECURITY: Audit log for subscription canceled
          if (existingSub?.user_id) {
            await logAuditEvent({
              event_type: 'subscription.canceled' as AuditEventType,
              user_id: existingSub.user_id,
              ip_address: getClientIP(req),
              success: true,
              metadata: {
                stripe_subscription_id: subscription.id,
              },
            }, supabaseClient);
          }

          // Enviar email de confirmación de cancelación
          if (existingSub && existingSub.user_id) {
            try {
              await supabaseClient.functions.invoke('send-subscription-notification', {
                body: {
                  userId: existingSub.user_id,
                  type: 'subscription_canceled',
                  metadata: {
                    planName: (existingSub.subscription_plans as Record<string, unknown>)?.display_name || 'Tu plan',
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

      // ============================================================================
      // REFUND AND CHARGEBACK HANDLERS
      // ============================================================================
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        console.log(`💰 REEMBOLSO: ${charge.id}, Amount: ${charge.amount_refunded}`);

        // Find user by stripe_customer_id
        const { data: userSub } = await supabaseClient
          .from('user_subscriptions')
          .select('user_id, status')
          .eq('stripe_customer_id', charge.customer as string)
          .single();

        // Record refund in payment history
        const { error: refundError } = await supabaseClient
          .from('payment_history')
          .insert({
            user_id: userSub?.user_id || null,
            stripe_payment_intent_id: charge.payment_intent as string,
            amount: -(charge.amount_refunded / 100), // Negative amount for refund
            currency: charge.currency.toUpperCase(),
            status: 'refunded',
            description: `Reembolso: ${charge.refunds?.data?.[0]?.reason || 'Sin razón especificada'}`,
            metadata: {
              charge_id: charge.id,
              refund_id: charge.refunds?.data?.[0]?.id,
              refund_reason: charge.refunds?.data?.[0]?.reason,
              original_amount: charge.amount / 100,
            },
          });

        if (refundError) {
          console.error('Error recording refund:', refundError);
        }

        // If full refund, suspend subscription access
        if (charge.refunded && userSub?.user_id) {
          console.log(`Full refund detected, suspending access for user ${userSub.user_id}`);

          const { error: suspendError } = await supabaseClient
            .from('user_subscriptions')
            .update({
              status: 'suspended',
              metadata: {
                suspended_reason: 'full_refund',
                suspended_at: new Date().toISOString(),
                original_charge_id: charge.id,
              },
            })
            .eq('user_id', userSub.user_id);

          if (suspendError) {
            console.error('Error suspending subscription after refund:', suspendError);
          }

          // Pause all active properties
          await supabaseClient
            .from('properties')
            .update({ status: 'pausada' })
            .eq('agent_id', userSub.user_id)
            .eq('status', 'activa');
        }

        // Notify admin
        const resendKeyRefund = Deno.env.get('RESEND_API_KEY');
        if (resendKeyRefund) {
          try {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendKeyRefund}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'Kentra Alertas <alertas@kentra.com.mx>',
                to: ['admin@kentra.com.mx'],
                subject: `💰 REEMBOLSO: $${(charge.amount_refunded / 100).toLocaleString('es-MX')} ${charge.currency.toUpperCase()}`,
                html: `
                  <h2>Se ha procesado un reembolso</h2>
                  <p><strong>Monto reembolsado:</strong> $${(charge.amount_refunded / 100).toLocaleString('es-MX')} ${charge.currency.toUpperCase()}</p>
                  <p><strong>Monto original:</strong> $${(charge.amount / 100).toLocaleString('es-MX')} ${charge.currency.toUpperCase()}</p>
                  <p><strong>Razón:</strong> ${charge.refunds?.data?.[0]?.reason || 'Sin razón especificada'}</p>
                  <p><strong>Usuario:</strong> ${userSub?.user_id || 'No identificado'}</p>
                  <p><strong>Reembolso completo:</strong> ${charge.refunded ? 'Sí' : 'No'}</p>
                  <p><a href="https://dashboard.stripe.com/payments/${charge.payment_intent}">Ver en Stripe Dashboard</a></p>
                `,
              }),
            });
          } catch (emailError) {
            console.error('Error sending refund email:', emailError);
          }
        }

        break;
      }

      case 'charge.refund.updated': {
        const refund = event.data.object as Stripe.Refund;
        console.log(`🔄 REFUND UPDATE: ${refund.id}, Status: ${refund.status}`);

        // Update payment history if refund failed
        if (refund.status === 'failed' || refund.status === 'canceled') {
          // Find and update the refund record
          await supabaseClient
            .from('payment_history')
            .update({
              status: refund.status === 'failed' ? 'refund_failed' : 'refund_canceled',
              metadata: {
                refund_failure_reason: refund.failure_reason,
                updated_at: new Date().toISOString(),
              },
            })
            .eq('stripe_payment_intent_id', refund.payment_intent as string)
            .eq('status', 'refunded');
        }

        break;
      }

      case 'review.opened': {
        const review = event.data.object as Stripe.Review;
        console.log(`🔍 FRAUD REVIEW OPENED: ${review.id}, Reason: ${review.reason}`);

        // Find user by payment intent
        const paymentIntent = review.payment_intent as string;
        const { data: paymentRecord } = await supabaseClient
          .from('payment_history')
          .select('user_id')
          .eq('stripe_payment_intent_id', paymentIntent)
          .single();

        // Log fraud review
        await supabaseClient
          .from('admin_audit_log')
          .insert({
            admin_id: '00000000-0000-0000-0000-000000000000', // System action
            action: 'fraud_review_opened',
            resource_type: 'payment',
            resource_id: paymentIntent,
            new_data: {
              review_id: review.id,
              reason: review.reason,
              user_id: paymentRecord?.user_id,
            },
          });

        // Notify admin
        const resendKeyReview = Deno.env.get('RESEND_API_KEY');
        if (resendKeyReview) {
          try {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendKeyReview}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'Kentra Alertas <alertas@kentra.com.mx>',
                to: ['admin@kentra.com.mx'],
                subject: `🔍 REVISIÓN DE FRAUDE: ${review.reason}`,
                html: `
                  <h2>Se ha abierto una revisión de fraude</h2>
                  <p><strong>Razón:</strong> ${review.reason}</p>
                  <p><strong>Usuario:</strong> ${paymentRecord?.user_id || 'No identificado'}</p>
                  <p><a href="https://dashboard.stripe.com/radar/reviews/${review.id}">Ver en Stripe Dashboard</a></p>
                `,
              }),
            });
          } catch (emailError) {
            console.error('Error sending fraud review email:', emailError);
          }
        }

        break;
      }

      case 'review.closed': {
        const review = event.data.object as Stripe.Review;
        console.log(`✅ FRAUD REVIEW CLOSED: ${review.id}, Closed reason: ${review.closed_reason}`);

        // Log review closure
        await supabaseClient
          .from('admin_audit_log')
          .insert({
            admin_id: '00000000-0000-0000-0000-000000000000', // System action
            action: 'fraud_review_closed',
            resource_type: 'payment',
            resource_id: review.payment_intent as string,
            new_data: {
              review_id: review.id,
              closed_reason: review.closed_reason,
            },
          });

        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    // Mark event as successfully processed
    await supabaseClient
      .from('stripe_webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('event_id', event.id);

    logger.info('Webhook processed successfully', { stripeEventId: event.id, duration: Date.now() - startTime });

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('Error processing webhook', {}, error as Error);
    // SECURITY: Don't expose internal error details (Stripe will see only generic error)
    return new Response(
      JSON.stringify({
        error: 'Webhook processing error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}));
