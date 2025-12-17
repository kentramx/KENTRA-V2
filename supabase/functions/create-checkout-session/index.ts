import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';
// @deno-types="https://esm.sh/stripe@11.16.0/types/index.d.ts"
import Stripe from 'https://esm.sh/stripe@11.16.0?target=deno';
import { createLogger } from '../_shared/logger.ts';
import { withRetry, isRetryableStripeError } from '../_shared/retry.ts';
import { withCircuitBreaker } from '../_shared/circuitBreaker.ts';
import { withSentry } from '../_shared/sentry.ts';

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
  maxRequests: number
): Response => {
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
  
  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: `Too many requests. Please try again in ${retryAfter} seconds.`,
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': resetTime.toString(),
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(withSentry(async (req) => {
  const logger = createLogger('create-checkout-session');
  const startTime = Date.now();

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting: 10 requests per hour
    const clientId = getClientIdentifier(req);
    const limit = checkRateLimit(clientId, { maxRequests: 10, windowMs: 60 * 60 * 1000 });
    
    if (!limit.allowed) {
      return createRateLimitResponse(limit.resetTime, 10);
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
    const finalSuccessUrl = successUrl || `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`;
    const finalCancelUrl = cancelUrl || `${origin}/pricing-agente`;

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
        const slotUpsellIds = upsells.filter((u: any) => 
          u.name?.toLowerCase().includes('slot adicional') || 
          u.name?.toLowerCase().includes('paquete')
        ).map((u: any) => u.id);

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

      // VALIDACIÓN 5: Verificar que todos los stripe_price_id de upsells sean válidos
      for (const upsell of upsells) {
        if (upsell.stripePriceId) {
          const isValid = await validateStripePriceId(upsell.stripePriceId);
          if (!isValid) {
            return new Response(
              JSON.stringify({ 
                error: `El servicio "${upsell.name || 'seleccionado'}" tiene una configuración de precio inválida. Contacta soporte.` 
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }

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
      const sessionParams: any = {
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
          upsell_ids: upsells.map((u: any) => u.id).join(','),
        },
      };

      // Aplicar cupón si fue validado
      if (validatedCoupon && validatedCoupon.stripe_coupon_id) {
        sessionParams.discounts = [{ coupon: validatedCoupon.stripe_coupon_id }];
      }

      const session = await withCircuitBreaker(
        'stripe-checkout',
        () => withRetry(
          () => stripe.checkout.sessions.create(sessionParams),
          {
            maxAttempts: 3,
            retryOn: isRetryableStripeError,
            onRetry: (attempt, error) => logger.warn(`Stripe retry ${attempt}`, { error: error.message }),
          }
        )
      ) as Stripe.Checkout.Session;

      logger.info('Upsell checkout session created', { sessionId: session.id, userId: user.id, duration: Date.now() - startTime });

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
    const sessionParams: any = {
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

    const session = await withCircuitBreaker(
      'stripe-checkout',
      () => withRetry(
        () => stripe.checkout.sessions.create(sessionParams),
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
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}));
