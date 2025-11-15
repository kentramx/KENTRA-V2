import { supabase } from '@/integrations/supabase/client';

/**
 * Inicia el proceso de checkout para una nueva suscripción
 */
export const startSubscriptionCheckout = async (
  planSlug: string,
  billingCycle: 'monthly' | 'yearly'
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    // Verificar si ya tiene suscripción activa
    const { data: activeSub } = await supabase
      .from('user_subscriptions')
      .select('id, status')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing', 'past_due'])
      .maybeSingle();

    if (activeSub) {
      return {
        success: false,
        error: 'Ya tienes una suscripción activa. Usa la opción de cambio de plan.',
      };
    }

    // Crear sesión de checkout
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: { planSlug, billingCycle },
    });

    if (error) {
      console.error('Error creating checkout:', error);
      return { success: false, error: error.message };
    }

    if (data?.url) {
      window.location.href = data.url;
      return { success: true };
    }

    return { success: false, error: 'No se pudo crear la sesión de pago' };
  } catch (error) {
    console.error('Exception in startSubscriptionCheckout:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
};

/**
 * Cambia el plan actual con prorrateo
 */
export const changePlan = async (
  targetPlanSlug: string,
  billingCycle: 'monthly' | 'yearly'
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('change-subscription-plan', {
      body: { targetPlanSlug, billingCycle },
    });

    if (error) {
      console.error('Error changing plan:', error);
      return { success: false, error: error.message };
    }

    if (!data?.success) {
      return { success: false, error: data?.error || 'Error al cambiar de plan' };
    }

    return { success: true };
  } catch (error) {
    console.error('Exception in changePlan:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
};

/**
 * Cancela la suscripción actual inmediatamente
 */
export const cancelSubscription = async (): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    const { data, error } = await supabase.functions.invoke('cancel-subscription');

    if (error) {
      console.error('Error canceling subscription:', error);
      return { success: false, error: error.message };
    }

    if (!data?.success) {
      return { success: false, error: data?.error || 'Error al cancelar suscripción' };
    }

    return { success: true };
  } catch (error) {
    console.error('Exception in cancelSubscription:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
};

/**
 * Obtiene información del plan actual del usuario
 */
export const getCurrentSubscription = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { subscription: null };
    }

    const { data, error } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        subscription_plans (
          name,
          display_name,
          price_monthly,
          price_yearly,
          features
        )
      `)
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing', 'past_due'])
      .single();

    if (error || !data) {
      return { subscription: null };
    }

    return { subscription: data };
  } catch (error) {
    console.error('Error getting current subscription:', error);
    return { subscription: null };
  }
};
