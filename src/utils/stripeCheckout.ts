import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CreateCheckoutSessionParams {
  planId: string;
  billingCycle: 'monthly' | 'yearly';
  successUrl: string;
  cancelUrl: string;
  couponCode?: string | null;
  upsells?: string[];
  upsellOnly?: boolean;
}

/**
 * Función centralizada para crear sesiones de checkout de Stripe
 * Elimina duplicación de código entre las diferentes páginas de pricing
 */
export const createStripeCheckoutSession = async (
  params: CreateCheckoutSessionParams
): Promise<{ success: boolean; checkoutUrl?: string; error?: string }> => {
  try {
    console.log('Creating Stripe checkout session:', params);

    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: {
        planId: params.planId,
        billingCycle: params.billingCycle,
        successUrl: params.successUrl,
        cancelUrl: params.cancelUrl,
        couponCode: params.couponCode || undefined,
        upsells: params.upsells || [],
        upsellOnly: params.upsellOnly || false,
      },
    });

    if (error) {
      console.error('Error creating checkout session:', error);
      return {
        success: false,
        error: error.message || 'Error al crear la sesión de pago',
      };
    }

    if (!data?.checkoutUrl) {
      return {
        success: false,
        error: 'No se pudo generar la URL de pago',
      };
    }

    return {
      success: true,
      checkoutUrl: data.checkoutUrl,
    };
  } catch (error) {
    console.error('Exception in createStripeCheckoutSession:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
};

/**
 * Valida si el usuario ya tiene una suscripción activa
 */
export const checkActiveSubscription = async (
  userId: string
): Promise<{ hasActive: boolean; planName?: string }> => {
  try {
    const { data: activeSub, error: subError } = await supabase
      .from('user_subscriptions')
      .select('id, subscription_plans(name)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (subError) {
      console.error('Error checking active subscription:', subError);
      return { hasActive: false };
    }

    return {
      hasActive: !!activeSub,
      planName: activeSub?.subscription_plans?.name,
    };
  } catch (error) {
    console.error('Exception checking active subscription:', error);
    return { hasActive: false };
  }
};

/**
 * Obtiene detalles de un plan por su slug y tipo
 */
export const getPlanBySlug = async (
  planType: 'agente' | 'inmobiliaria' | 'desarrolladora',
  planSlug: string
): Promise<{ plan: any; error?: string }> => {
  try {
    const fullPlanName = `${planType}_${planSlug}`;

    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('id, name, display_name, price_monthly, price_yearly')
      .eq('name', fullPlanName)
      .single();

    if (planError || !plan) {
      console.error('Plan not found:', fullPlanName, planError);
      return {
        plan: null,
        error: 'No se pudo encontrar el plan seleccionado',
      };
    }

    return { plan };
  } catch (error) {
    console.error('Exception getting plan:', error);
    return {
      plan: null,
      error: error instanceof Error ? error.message : 'Error al obtener plan',
    };
  }
};
