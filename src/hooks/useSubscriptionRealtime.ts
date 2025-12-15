import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface SubscriptionPlan {
  id: string;
  name: string;
  display_name: string;
  price_monthly: number;
  price_yearly: number | null;
  features: unknown;
}

interface SubscriptionData {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  featured_used_this_month: number | null;
  featured_reset_date: string | null;
  subscription_plans?: SubscriptionPlan;
}

interface UseSubscriptionRealtimeOptions {
  onUpdate?: (subscription: SubscriptionData) => void;
  onStatusChange?: (oldStatus: string, newStatus: string) => void;
  showToasts?: boolean;
}

export function useSubscriptionRealtime(options: UseSubscriptionRealtimeOptions = {}) {
  const { user } = useAuth();
  const { onUpdate, onStatusChange, showToasts = true } = options;
  
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const previousStatusRef = useRef<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (!user?.id) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          subscription_plans (
            id,
            name,
            display_name,
            price_monthly,
            price_yearly,
            features
          )
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      
      setSubscription(data);
      previousStatusRef.current = data?.status || null;
    } catch (err) {
      console.error('[useSubscriptionRealtime] Fetch error:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const handleSubscriptionUpdate = useCallback((payload: { new: unknown; old: unknown }) => {
    console.log('[useSubscriptionRealtime] Update received:', payload);
    
    const newData = payload.new as SubscriptionData;
    const oldData = payload.old as SubscriptionData;
    
    fetchSubscription().then(() => {
      if (oldData?.status && newData?.status && oldData.status !== newData.status) {
        onStatusChange?.(oldData.status, newData.status);
        
        if (showToasts) {
          const messages: Record<string, string> = {
            'active': '✅ Tu suscripción está activa',
            'past_due': '⚠️ Hay un problema con tu pago',
            'canceled': '❌ Tu suscripción ha sido cancelada',
            'suspended': '🚫 Tu cuenta ha sido suspendida',
            'trialing': '🎉 Tu período de prueba ha comenzado',
          };
          
          const message = messages[newData.status];
          if (message) {
            if (newData.status === 'active') {
              toast.success(message);
            } else if (newData.status === 'past_due' || newData.status === 'suspended') {
              toast.error(message);
            } else {
              toast.info(message);
            }
          }
        }
      }
      
      onUpdate?.(newData);
    });
  }, [fetchSubscription, onStatusChange, onUpdate, showToasts]);

  useEffect(() => {
    if (!user?.id) return;

    fetchSubscription();

    const channel = supabase
      .channel(`subscription-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_subscriptions',
          filter: `user_id=eq.${user.id}`,
        },
        handleSubscriptionUpdate
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_subscriptions',
          filter: `user_id=eq.${user.id}`,
        },
        handleSubscriptionUpdate
      )
      .subscribe((status) => {
        console.log('[useSubscriptionRealtime] Channel status:', status);
      });

    return () => {
      console.log('[useSubscriptionRealtime] Cleaning up channel');
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchSubscription, handleSubscriptionUpdate]);

  return {
    subscription,
    loading,
    error,
    refetch: fetchSubscription,
  };
}
