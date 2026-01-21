import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';
// @deno-types="https://esm.sh/stripe@11.16.0/types/index.d.ts"
import Stripe from 'https://esm.sh/stripe@11.16.0?target=deno';
import { createLogger } from '../_shared/logger.ts';
import { withRetry, isRetryableStripeError } from '../_shared/retry.ts';
import { withCircuitBreaker } from '../_shared/circuitBreaker.ts';
import { withSentry } from '../_shared/sentry.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { checkBodySize, bodySizeLimitResponse, BODY_SIZE_LIMITS } from '../_shared/validation.ts';
import { checkRateLimit as checkRedisRateLimit } from '../_shared/redis.ts';

/**
 * Validates that a redirect URL is safe (on allowed domain)
 * Prevents open redirect attacks in payment flows
 */
const ALLOWED_DOMAINS = ['kentra.mx', 'kentra.com.mx', 'www.kentra.mx', 'www.kentra.com.mx', 'localhost:5173', 'localhost:3000'];
function isValidRedirectUrl(url: string | undefined, origin: string): boolean {
  if (!url) return true; // undefined is OK, will use default

  try {
    const parsed = new URL(url);
    // Allow URLs on the same origin
    const originHost = new URL(origin).hostname;
    if (parsed.hostname === originHost) return true;
    // Allow URLs on allowed domains
    return ALLOWED_DOMAINS.some(domain =>
      parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
    );
  } catch {
    // Invalid URL - could be a relative path, check it starts with /
    if (url.startsWith('/') && !url.startsWith('//')) {
      return true;
    }
    return false;
  }
}

// Rate limiting utilities inlined
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const limits = new Map<string, RateLimitEntry>();

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const checkRateLimit = (
  key: string, 
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetTime: number } => {
  const now = Date.now();
  const entry = limits.get(key);

  if (!entry || now > entry.resetTime) {
    const resetTime = now + config.windowMs;
    limits.set(key, { count: 1, resetTime });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime,
    };
  }

  if (entry.count < config.maxRequests) {
    entry.count++;
    limits.set(key, entry);
    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  return {
    allowed: false,
    remaining: 0,
    resetTime: entry.resetTime,
  };
};

const getClientIdentifier = (req: Request): string => {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  
  return cfConnectingIp || realIp || forwarded?.split(',')[0] || 'unknown';
};

const createRateLimitResponse = (
  resetTime: number,
  maxRequests: number,
  origin: string | null
): Response => {
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
  const headers = getCorsHeaders(origin);

  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: `Too many requests. Please try again in ${retryAfter} seconds.`,
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': resetTime.toString(),
      },
    }
  );
};

Deno.serve(withSentry(async (req) => {
  const logger = createLogger('create-checkout-session');
  const startTime = Date.now();
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Check body size before reading
    const bodySizeResult = await checkBodySize(req, BODY_SIZE_LIMITS.DEFAULT);
    if (!bodySizeResult.allowed) {
      logger.warn('Request body too large', { size: bodySizeResult.size });
      return bodySizeLimitResponse(corsHeaders);
    }

    // Rate limiting: 10 requests per hour (using Redis for distributed limiting)
    const clientId = getClientIdentifier(req);
    let limit: { allowed: boolean; remaining: number; resetAt: number };

    try {
      limit = await checkRedisRateLimit(`checkout:${clientId}`, 10, 3600); // 10 requests per hour
    } catch (redisError) {
      // Fallback to in-memory if Redis unavailable
      logger.warn('Redis rate limit unavailable, using in-memory fallback', { error: redisError });
      const memLimit = checkRateLimit(clientId, { maxRequests: 10, windowMs: 60 * 60 * 1000 });
      limit = { allowed: memLimit.allowed, remaining: memLimit.remaining, resetAt: memLimit.resetTime };
    }

    if (!limit.allowed) {
      const origin = req.headers.get('origin');
      return createRateLimitResponse(limit.resetAt, 10, origin);
    }

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

    const body = await req.json();
    const { planSlug, billingCycle, successUrl, cancelUrl, upsells = [], upsellOnly = false, couponCode } = body;
    // Soporte para planSlug (nuevo) o planId (legacy)
    const planIdentifier = planSlug || body.planId;

    // === GENERAR URLs DE REDIRECCIÓN POR DEFECTO ===
    const origin = req.headers.get('origin') || 'https://kentra.mx';

    // SECURITY: Validate redirect URLs to prevent open redirect attacks
    if (!isValidRedirectUrl(successUrl, origin)) {
      return new Response(JSON.stringify({
        error: 'Invalid successUrl - must be on kentra.mx domain'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!isValidRedirectUrl(cancelUrl, origin)) {
      return new Response(JSON.stringify({
        error: 'Invalid cancelUrl - must be on kentra.mx domain'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Determinar tipo de plan para URLs dinámicas
    const determinePlanType = (planId: string): string => {
      if (!planId) return 'agente';
      const lowerPlan = planId.toLowerCase();
      if (lowerPlan.includes('inmobiliaria')) return 'inmobiliaria';
      if (lowerPlan.includes('desarrolladora')) return 'desarrolladora';
      return 'agente';
    };
    
    const planType = determinePlanType(planIdentifier);
    const checkoutType = upsellOnly ? 'upsell' : 'subscription';
    
    // URL de éxito con todos los parámetros necesarios
    const finalSuccessUrl = successUrl || `${origin}/payment-success?payment=success&session_id={CHECKOUT_SESSION_ID}&type=${checkoutType}`;
    // URL de cancelación dinámica según tipo de plan
    const finalCancelUrl = cancelUrl || `${origin}/payment-canceled?type=${planType}`;

    // Supabase Admin client para validar cupones
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Validar cupón si se proporcionó
    let validatedCoupon = null;
    if (couponCode) {
      const { data: couponValidation, error: couponError } = await supabaseAdmin
        .rpc('validate_coupon', {
          p_code: couponCode,
          p_user_id: user.id,
          p_plan_type: null
        });

      if (couponError) {
        console.error('Error validating coupon:', couponError);
        throw new Error('Error al validar cupón');
      }

      if (couponValidation && couponValidation.length > 0) {
        const validation = couponValidation[0];
        if (!validation.is_valid) {
          return new Response(
            JSON.stringify({ error: validation.message }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            }
          );
        }
        validatedCoupon = validation;
        console.log('Coupon validated:', validatedCoupon);
      }
    }

    console.log('Creating checkout session for:', {
      userId: user.id,
      planIdentifier,
      billingCycle,
      upsellOnly,
    });

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // VALIDACIÓN 5: Función auxiliar para verificar que stripe_price_id existe en Stripe
    const validateStripePriceId = async (priceId: string): Promise<boolean> => {
      try {
        await stripe.prices.retrieve(priceId);
        return true;
      } catch (error) {
        console.error('Invalid stripe_price_id:', priceId, error);
        return false;
      }
    };

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

      // VALIDACIÓN 6: Verificar límite de slots adicionales
      if (upsells && upsells.length > 0) {
        const slotUpsellIds = upsells.filter((u: Record<string, unknown>) => 
          u.name?.toLowerCase().includes('slot adicional') || 
          u.name?.toLowerCase().includes('paquete')
        ).map((u: Record<string, unknown>) => u.id);

        if (slotUpsellIds.length > 0) {
          const { data: activeSlots, error: slotsError } = await supabaseClient
            .from('user_active_upsells')
            .select('id')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .in('upsell_id', slotUpsellIds);

          if (slotsError) {
            console.error('Error checking active slots:', slotsError);
          } else if (activeSlots && activeSlots.length >= 10) {
            return new Response(
              JSON.stringify({ 
                error: 'Has alcanzado el límite máximo de 10 slots adicionales. Considera mejorar tu plan.' 
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }

      const customerId = activeSub.stripe_customer_id;

      // Obtener IDs y cantidades de upsells del frontend
      const upsellIds = upsells.map((u: Record<string, unknown>) => u.id).filter(Boolean);
      const upsellQuantities: Record<string, number> = {};
      upsells.forEach((u: Record<string, unknown>) => {
        if (u.id) {
          upsellQuantities[u.id] = Math.max(1, Math.min(u.quantity || 1, 100)); // Entre 1 y 100
        }
      });
      
      if (upsellIds.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No se proporcionaron servicios adicionales válidos' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar detalles de upsells en la base de datos (incluido stripe_price_id)
      const { data: upsellDetails, error: upsellFetchError } = await supabaseAdmin
        .from('upsells')
        .select('id, name, stripe_price_id, is_recurring')
        .in('id', upsellIds);

      if (upsellFetchError || !upsellDetails || upsellDetails.length === 0) {
        console.error('Error fetching upsells:', upsellFetchError);
        return new Response(
          JSON.stringify({ error: 'Servicios adicionales no encontrados' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validar que todos los upsells tengan stripe_price_id configurado
      for (const upsell of upsellDetails) {
        if (!upsell.stripe_price_id) {
          return new Response(
            JSON.stringify({ 
              error: `El servicio "${upsell.name}" no tiene precio configurado en Stripe. Contacta soporte.` 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Verificar que el stripe_price_id sea válido en Stripe
        const isValid = await validateStripePriceId(upsell.stripe_price_id);
        if (!isValid) {
          return new Response(
            JSON.stringify({ 
              error: `El servicio "${upsell.name}" tiene una configuración de precio inválida. Contacta soporte.` 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Line items usando datos de la DB (no del cliente - más seguro) con cantidad del frontend
      const lineItems = upsellDetails.map((upsell) => ({
        price: upsell.stripe_price_id,
        quantity: upsellQuantities[upsell.id] || 1,
      }));

      // Determinar mode según si hay recurrentes (usando datos de la DB)
      const hasRecurring = upsellDetails.some((u) => u.is_recurring);
      const mode = hasRecurring ? 'subscription' : 'payment';

      console.log('Creating upsell checkout with line items:', lineItems, 'mode:', mode);

      // Crear sesión
      const sessionParams: Record<string, unknown> = {
        mode,
        payment_method_types: ['card'],
        customer: customerId,
        line_items: lineItems,
        success_url: finalSuccessUrl,
        cancel_url: finalCancelUrl,
        client_reference_id: user.id,
        metadata: {
          user_id: user.id,
          upsell_only: 'true',
          upsell_ids: upsellDetails.map((u) => u.id).join(','),
          upsell_quantities: upsellDetails.map((u) => upsellQuantities[u.id] || 1).join(','),
        },
      };

      // Aplicar cupón si fue validado
      if (validatedCoupon && validatedCoupon.stripe_coupon_id) {
        sessionParams.discounts = [{ coupon: validatedCoupon.stripe_coupon_id }];
      }

      // SECURITY: Idempotency key prevents duplicate charges on retries
      const idempotencyKey = `upsell-${user.id}-${Date.now()}`;
      const session = await withCircuitBreaker(
        'stripe-checkout',
        () => withRetry(
          () => stripe.checkout.sessions.create(sessionParams, { idempotencyKey }),
          {
            maxAttempts: 3,
            retryOn: isRetryableStripeError,
            onRetry: (attempt, error) => logger.warn(`Stripe retry ${attempt}`, { error: error.message }),
          }
        )
      ) as Stripe.Checkout.Session;

      logger.info('Upsell checkout session created', { sessionId: session.id, userId: user.id, idempotencyKey, duration: Date.now() - startTime });

      return new Response(
        JSON.stringify({ 
          checkoutUrl: session.url,
          sessionId: session.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get plan details (flujo normal con plan) - buscar por name (slug)
    const { data: plan, error: planError } = await supabaseClient
      .from('subscription_plans')
      .select('*')
      .eq('name', planIdentifier)
      .single();

    if (planError || !plan) {
      console.error('Plan error:', planError);
      return new Response(JSON.stringify({ error: 'Plan not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // VALIDACIÓN P2: Verificar que la moneda del plan coincida con MXN (moneda predeterminada)
    const planCurrency = plan.currency?.toUpperCase() || 'MXN';
    const expectedCurrency = 'MXN';
    if (planCurrency !== expectedCurrency) {
      logger.warn('Currency mismatch in plan', { 
        planId: plan.id, 
        planCurrency, 
        expectedCurrency 
      });
      // Solo advertir, no bloquear - Stripe convertirá automáticamente
    }

    // VALIDACIÓN 5: Verificar que el stripe_price_id del plan sea válido
    const isPlanPriceValid = await validateStripePriceId(priceId);
    if (!isPlanPriceValid) {
      return new Response(
        JSON.stringify({ 
          error: 'El plan seleccionado tiene una configuración de precio inválida. Contacta soporte.' 
        }),
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
      // SECURITY: Idempotency key prevents duplicate customer creation
      const customerIdempotencyKey = `customer-${user.id}-${Date.now()}`;
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          user_id: user.id,
        },
      }, { idempotencyKey: customerIdempotencyKey });
      customerId = customer.id;
      logger.info('Created new Stripe customer', { customerId, userId: user.id });
    }

    // Build line items (plan + upsells)
    // SECURITY: Validate upsells from database instead of trusting client-provided price IDs
    let validatedUpsellLineItems: { price: string; quantity: number }[] = [];
    if (upsells && upsells.length > 0) {
      const upsellIds = upsells.map((u: Record<string, unknown>) => u.id).filter(Boolean);

      if (upsellIds.length > 0) {
        // Fetch upsells from database to get validated stripe_price_ids
        const { data: upsellDetails, error: upsellFetchError } = await supabaseAdmin
          .from('upsells')
          .select('id, name, stripe_price_id, is_recurring')
          .in('id', upsellIds);

        if (upsellFetchError) {
          console.error('Error fetching upsells:', upsellFetchError);
          return new Response(
            JSON.stringify({ error: 'Error validating additional services' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (upsellDetails && upsellDetails.length > 0) {
          // Validate each upsell has a valid stripe_price_id
          for (const upsell of upsellDetails) {
            if (!upsell.stripe_price_id) {
              return new Response(
                JSON.stringify({
                  error: `El servicio "${upsell.name}" no tiene precio configurado. Contacta soporte.`
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }

            // Validate stripe_price_id exists in Stripe
            const isValid = await validateStripePriceId(upsell.stripe_price_id);
            if (!isValid) {
              return new Response(
                JSON.stringify({
                  error: `El servicio "${upsell.name}" tiene configuración inválida. Contacta soporte.`
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }

          // Build validated line items using DB price IDs (not client-provided)
          const upsellQuantities: Record<string, number> = {};
          upsells.forEach((u: Record<string, unknown>) => {
            if (u.id) {
              upsellQuantities[u.id] = Math.max(1, Math.min(u.quantity || 1, 100));
            }
          });

          validatedUpsellLineItems = upsellDetails.map((upsell) => ({
            price: upsell.stripe_price_id,
            quantity: upsellQuantities[upsell.id] || 1,
          }));
        }
      }
    }

    const lineItems = [
      {
        price: priceId,
        quantity: 1,
      },
      ...validatedUpsellLineItems,
    ];

    // METADATA COMPLETA para webhook - CRÍTICO para sincronización correcta
    const metadata: Record<string, string> = {
      user_id: user.id,
      plan_id: plan.id, // CRÍTICO: Necesario para que el webhook actualice la suscripción
      plan_slug: upsellOnly ? 'upsell' : plan.name,
      billing_cycle: billingCycle,
      upsell_only: upsellOnly.toString(),
      environment: 'production',
    };

    if (upsells && upsells.length > 0) {
      metadata.upsells = JSON.stringify(upsells);
    }

    if (couponCode) {
      metadata.coupon_code = couponCode;
    }

    console.log('Creating checkout with line items:', lineItems);

    // Determine mode
    const mode = upsellOnly ? 'payment' : 'subscription';

    // Create checkout session
    const sessionParams: Record<string, unknown> = {
      mode,
      payment_method_types: ['card'],
      customer: customerId,
      line_items: lineItems,
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
      client_reference_id: user.id,
      metadata,
      ...(mode === 'subscription' ? {
        subscription_data: {
          metadata: {
            plan_id: plan.id,
            user_id: user.id,
          },
        },
      } : {}),
    };

    // Aplicar cupón si fue validado
    if (validatedCoupon && validatedCoupon.stripe_coupon_id) {
      sessionParams.discounts = [{ coupon: validatedCoupon.stripe_coupon_id }];
    }

    // SECURITY: Idempotency key prevents duplicate charges on retries
    const idempotencyKey = `checkout-${user.id}-${plan.id}-${billingCycle}-${Date.now()}`;
    const session = await withCircuitBreaker(
      'stripe-checkout',
      () => withRetry(
        () => stripe.checkout.sessions.create(sessionParams, { idempotencyKey }),
        {
          maxAttempts: 3,
          retryOn: isRetryableStripeError,
          onRetry: (attempt, error) => logger.warn(`Stripe retry ${attempt}`, { error: error.message }),
        }
      )
    ) as Stripe.Checkout.Session;

    logger.info('Checkout session created', {
      sessionId: session.id,
      userId: user.id,
      planSlug: plan.name,
      billingCycle,
      idempotencyKey,
      duration: Date.now() - startTime,
    });

    return new Response(
      JSON.stringify({ 
        checkoutUrl: session.url,
        sessionId: session.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('Error creating checkout session', {}, error as Error);
    // SECURITY: Don't expose internal error details to clients
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}));
