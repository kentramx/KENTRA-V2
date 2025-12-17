import { createContext, useContext, ReactNode, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

interface SubscriptionPlan {
  id: string;
  name: string;
  display_name: string;
  price_monthly: number;
  price_yearly: number | null;
  features: {
    limits?: {
      max_properties?: number;
      featured_per_month?: number;
      max_agents?: number;
      max_projects?: number;
    };
    // Fallback para estructura plana legacy
    properties_limit?: number;
    featured_limit?: number;
    [key: string]: unknown;
  };
}

type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'suspended' | 'expired' | 'incomplete';

interface SubscriptionData {
  id: string;
  status: SubscriptionStatus;
  plan: SubscriptionPlan | null;
  billingCycle: 'monthly' | 'yearly';
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

interface SubscriptionLimits {
  maxProperties: number;
  currentProperties: number;
  remainingProperties: number;
  usagePercent: number;
  isAtLimit: boolean;
  isNearLimit: boolean;
}

interface SubscriptionAlerts {
  showPaymentFailed: boolean;
  showTrialExpiring: boolean;
  showSubscriptionExpiring: boolean;
  showAtPropertyLimit: boolean;
  showNearPropertyLimit: boolean;
}

interface SubscriptionState {
  isLoading: boolean;
  hasSubscription: boolean;
  subscription: SubscriptionData | null;
  
  // Estados derivados
  isActive: boolean;
  isTrial: boolean;
  isPastDue: boolean;
  isSuspended: boolean;
  isCanceled: boolean;
  
  // Trial específico
  trialDaysRemaining: number | null;
  isTrialExpiringSoon: boolean;
  
  // Límites
  limits: SubscriptionLimits;
  
  // Alertas activas
  alerts: SubscriptionAlerts;
  
  // Acciones
  refetch: () => Promise<void>;
}

const defaultLimits: SubscriptionLimits = {
  maxProperties: 0,
  currentProperties: 0,
  remainingProperties: 0,
  usagePercent: 100,
  isAtLimit: true,
  isNearLimit: false,
};

const defaultAlerts: SubscriptionAlerts = {
  showPaymentFailed: false,
  showTrialExpiring: false,
  showSubscriptionExpiring: false,
  showAtPropertyLimit: false,
  showNearPropertyLimit: false,
};

const SubscriptionContext = createContext<SubscriptionState | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<Omit<SubscriptionState, 'refetch'>>({
    isLoading: true,
    hasSubscription: false,
    subscription: null,
    isActive: false,
    isTrial: false,
    isPastDue: false,
    isSuspended: false,
    isCanceled: false,
    trialDaysRemaining: null,
    isTrialExpiringSoon: false,
    limits: defaultLimits,
    alerts: defaultAlerts,
  });

  const fetchSubscription = useCallback(async () => {
    if (!user?.id) {
      setState(prev => ({ ...prev, isLoading: false, hasSubscription: false }));
      return;
    }

    try {
      // Fetch subscription with plan
      const { data: sub, error: subError } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          subscription_plans (*)
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (subError) throw subError;

      // Fetch property count
      const { count: propertyCount } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', user.id)
        .in('status', ['activa', 'pendiente_aprobacion']);

      const currentCount = propertyCount || 0;

      if (!sub) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          hasSubscription: false,
          subscription: null,
          isActive: false,
          limits: {
            ...defaultLimits,
            currentProperties: currentCount,
          },
          alerts: defaultAlerts,
        }));
        return;
      }

      const plan = sub.subscription_plans as SubscriptionPlan | null;
      const features = plan?.features || {};
      // Leer de estructura anidada (features.limits.max_properties) con fallback a estructura plana
      const limits = features.limits || {};
      const maxProps = limits.max_properties ?? (features.properties_limit as number) ?? 0;
      const remaining = Math.max(0, maxProps - currentCount);
      const usagePercent = maxProps > 0 ? (currentCount / maxProps) * 100 : 100;

      const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
      const now = new Date();
      const daysUntilEnd = periodEnd 
        ? Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) 
        : null;

      const isTrial = sub.status === 'trialing';
      const isActive = sub.status === 'active' || isTrial;
      const isPastDue = sub.status === 'past_due';
      const isSuspended = sub.status === 'suspended';
      const isCanceled = sub.status === 'canceled' || 
        (sub.cancel_at_period_end && periodEnd && periodEnd < now);

      setState({
        isLoading: false,
        hasSubscription: true,
        subscription: {
          id: sub.id,
          status: sub.status as SubscriptionStatus,
          plan,
          billingCycle: (sub.billing_cycle as 'monthly' | 'yearly') || 'monthly',
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: sub.cancel_at_period_end || false,
        },
        isActive,
        isTrial,
        isPastDue,
        isSuspended,
        isCanceled,
        trialDaysRemaining: isTrial ? daysUntilEnd : null,
        isTrialExpiringSoon: isTrial && daysUntilEnd !== null && daysUntilEnd <= 3,
        limits: {
          maxProperties: maxProps,
          currentProperties: currentCount,
          remainingProperties: remaining,
          usagePercent,
          isAtLimit: remaining <= 0,
          isNearLimit: usagePercent >= 80 && usagePercent < 100,
        },
        alerts: {
          showPaymentFailed: isPastDue,
          showTrialExpiring: isTrial && daysUntilEnd !== null && daysUntilEnd <= 3,
          showSubscriptionExpiring: sub.cancel_at_period_end && daysUntilEnd !== null && daysUntilEnd <= 7,
          showAtPropertyLimit: remaining <= 0 && isActive,
          showNearPropertyLimit: usagePercent >= 80 && usagePercent < 100 && isActive,
        },
      });
    } catch (error) {
      console.error('[SubscriptionContext] Error:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [user?.id]);

  // Initial fetch
  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`subscription-context-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_subscriptions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[SubscriptionContext] New subscription created');
          fetchSubscription();
          
          // Show welcome toast for new subscriptions
          const newSub = payload.new as { status?: string };
          if (newSub.status === 'active' || newSub.status === 'trialing') {
            toast.success('¡Suscripción activada!', {
              description: 'Ya puedes comenzar a publicar tus propiedades.',
              duration: 5000,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_subscriptions',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchSubscription();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'properties',
          filter: `agent_id=eq.${user.id}`,
        },
        () => {
          fetchSubscription();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchSubscription]);

  return (
    <SubscriptionContext.Provider value={{ ...state, refetch: fetchSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}

// Hook específico para verificar si puede crear propiedad
export function useCanCreateProperty() {
  const { isActive, limits, isLoading } = useSubscription();
  
  return {
    canCreate: isActive && !limits.isAtLimit,
    isLoading,
    reason: !isActive 
      ? 'No tienes una suscripción activa'
      : limits.isAtLimit 
        ? `Has alcanzado el límite de ${limits.maxProperties} propiedades de tu plan`
        : null,
    remaining: limits.remainingProperties,
  };
}
