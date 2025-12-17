import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';
import { createLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  const logger = createLogger('start-trial');

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

    // Verificar usuario autenticado
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

    // Obtener IP y device fingerprint del request
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                      req.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    
    const { deviceFingerprint } = await req.json();

    logger.info('Starting trial', { userId: user.id, ip: ipAddress?.slice(0, 10) });

    // Validar si ya tuvo trial desde este dispositivo
    const { data: trialValidation, error: validationError } = await supabaseClient
      .rpc('can_get_trial', {
        p_ip_address: ipAddress,
        p_device_fingerprint: deviceFingerprint,
      });

    if (validationError) {
      console.error('Error validating trial:', validationError);
      throw validationError;
    }

    if (!trialValidation || !trialValidation[0]?.can_trial) {
      const reason = trialValidation?.[0]?.reason || 'No puedes iniciar un trial';
      logger.warn('Trial denied', { userId: user.id, reason });
      
      return new Response(
        JSON.stringify({
          error: 'TRIAL_ALREADY_USED',
          message: reason,
          previousTrials: trialValidation?.[0]?.previous_trials || 0,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar que no tenga ya una suscripción activa
    const { data: existingSub } = await supabaseClient
      .from('user_subscriptions')
      .select('id, status')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .maybeSingle();

    if (existingSub) {
      return new Response(
        JSON.stringify({
          error: 'ALREADY_SUBSCRIBED',
          message: 'Ya tienes una suscripción activa',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obtener plan trial
    const { data: trialPlan, error: planError } = await supabaseClient
      .from('subscription_plans')
      .select('*')
      .eq('name', 'agente_trial')
      .single();

    if (planError || !trialPlan) {
      console.error('Trial plan not found:', planError);
      return new Response(
        JSON.stringify({ error: 'Trial plan not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Crear suscripción trial - CRÍTICO: status debe ser 'trialing' no 'active'
    const TRIAL_DURATION_DAYS = 14; // Centralizado
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DURATION_DAYS);

    const { data: newSubscription, error: subError } = await supabaseClient
      .from('user_subscriptions')
      .insert({
        user_id: user.id,
        plan_id: trialPlan.id,
        status: 'trialing', // CORREGIDO: Era 'active', debe ser 'trialing'
        billing_cycle: 'monthly',
        current_period_start: new Date().toISOString(),
        current_period_end: trialEndDate.toISOString(),
        stripe_customer_id: null, // Trial no usa Stripe
        stripe_subscription_id: null,
      })
      .select()
      .single();

    if (subError) {
      console.error('Error creating trial subscription:', subError);
      throw subError;
    }

    logger.info('Trial subscription created', { subscriptionId: newSubscription.id, userId: user.id });

    // === ASIGNAR ROL DE AGENTE AUTOMÁTICAMENTE ===
    // Verificar si ya tiene el rol de agente
    const { data: existingRole } = await supabaseClient
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'agent')
      .maybeSingle();

    if (!existingRole) {
      const { error: roleError } = await supabaseClient
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: 'agent',
        });

      if (roleError) {
        console.error('Error assigning agent role:', roleError);
      } else {
        console.log('Agent role assigned to user:', user.id);
      }
    } else {
      console.log('User already has agent role:', user.id);
    }

    // Registrar en trial_tracking para prevenir duplicados
    const { error: trackError } = await supabaseClient
      .from('trial_tracking')
      .insert({
        user_id: user.id,
        ip_address: ipAddress,
        user_agent: userAgent,
        device_fingerprint: deviceFingerprint,
        trial_started_at: new Date().toISOString(),
      });

    if (trackError) {
      console.error('Error tracking trial (non-critical):', trackError);
    }

    // Enviar email de bienvenida al trial
    try {
      await supabaseClient.functions.invoke('send-subscription-notification', {
        body: {
          userId: user.id,
          type: 'trial_started',
          metadata: {
            trialDays: TRIAL_DURATION_DAYS,
            expiryDate: trialEndDate.toLocaleDateString('es-MX', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
          },
        },
      });
    } catch (emailError) {
      console.error('Error sending trial welcome email:', emailError);
      // No bloqueamos si falla el email
    }

    console.log('Trial started successfully for user:', user.id);

    return new Response(
      JSON.stringify({
        success: true,
        subscription: newSubscription,
        expiryDate: trialEndDate.toISOString(),
        daysRemaining: TRIAL_DURATION_DAYS,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error starting trial:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
