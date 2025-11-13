import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener el usuario autenticado
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'No autorizado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'No autorizado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obtener suscripción local del usuario
    const { data: localSubscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('id, stripe_subscription_id, status, cancel_at_period_end')
      .eq('user_id', user.id)
      .eq('status', 'canceled')
      .single();

    if (subError || !localSubscription || !localSubscription.stripe_subscription_id) {
      // No hay suscripción cancelada que sincronizar
      return new Response(
        JSON.stringify({ success: true, message: 'No hay suscripción que sincronizar' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obtener estado real desde Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(
      localSubscription.stripe_subscription_id
    );

    console.log('Stripe subscription status:', stripeSubscription.status);
    console.log('Stripe cancel_at_period_end:', stripeSubscription.cancel_at_period_end);
    console.log('Local cancel_at_period_end:', localSubscription.cancel_at_period_end);

    // Actualizar si hay discrepancia
    if (stripeSubscription.status === 'canceled' && localSubscription.cancel_at_period_end === true) {
      // La suscripción está completamente cancelada en Stripe pero localmente aún tiene cancel_at_period_end = true
      const { error: updateError } = await supabase
        .from('user_subscriptions')
        .update({
          cancel_at_period_end: false,
          status: 'canceled'
        })
        .eq('id', localSubscription.id);

      if (updateError) {
        console.error('Error actualizando suscripción:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: 'Error al actualizar estado local' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Suscripción sincronizada: cancel_at_period_end actualizado a false');
      return new Response(
        JSON.stringify({ 
          success: true, 
          updated: true,
          message: 'Estado de suscripción sincronizado con Stripe'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated: false,
        message: 'La suscripción ya está sincronizada'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error en sync-subscription-status:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
