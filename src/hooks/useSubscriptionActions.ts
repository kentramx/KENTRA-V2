import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SubscriptionState {
  status?: string;
  cancel_at_period_end?: boolean;
  plan_id?: string;
}

interface UseSubscriptionActionsOptions {
  onOptimisticUpdate?: (update: Partial<SubscriptionState>) => void;
  onRollback?: (previousState: SubscriptionState) => void;
  onSuccess?: (action: string) => void;
  onError?: (action: string, error: Error) => void;
}

export function useSubscriptionActions(options: UseSubscriptionActionsOptions = {}) {
  const { onOptimisticUpdate, onRollback, onSuccess, onError } = options;
  const [loading, setLoading] = useState<string | null>(null);

  const cancel = useCallback(async (currentState?: SubscriptionState) => {
    const previousState = currentState || {};
    
    setLoading('cancel');
    onOptimisticUpdate?.({ cancel_at_period_end: true });
    
    try {
      const { data, error } = await supabase.functions.invoke('cancel-subscription');
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast.success('Suscripción cancelada. Tendrás acceso hasta el final de tu período de facturación.');
      onSuccess?.('cancel');
      
      return { success: true };
    } catch (error) {
      console.error('[useSubscriptionActions] Cancel error:', error);
      onRollback?.(previousState);
      
      const errorMessage = error instanceof Error ? error.message : 'Error al cancelar';
      toast.error(errorMessage);
      onError?.('cancel', error as Error);
      
      return { success: false, error };
    } finally {
      setLoading(null);
    }
  }, [onOptimisticUpdate, onRollback, onSuccess, onError]);

  const reactivate = useCallback(async (currentState?: SubscriptionState) => {
    const previousState = currentState || {};
    
    setLoading('reactivate');
    onOptimisticUpdate?.({ cancel_at_period_end: false, status: 'active' });
    
    try {
      const { data, error } = await supabase.functions.invoke('reactivate-subscription');
      
      if (error) throw error;
      
      if (data?.code === 'SUBSCRIPTION_ALREADY_CANCELED') {
        toast.info('Tu suscripción ya expiró. Por favor inicia una nueva suscripción.');
        onRollback?.(previousState);
        return { success: false, code: 'SUBSCRIPTION_ALREADY_CANCELED' };
      }
      
      if (data?.error) throw new Error(data.error);
      
      toast.success('¡Suscripción reactivada exitosamente!');
      onSuccess?.('reactivate');
      
      return { success: true };
    } catch (error) {
      console.error('[useSubscriptionActions] Reactivate error:', error);
      onRollback?.(previousState);
      
      const errorMessage = error instanceof Error ? error.message : 'Error al reactivar';
      toast.error(errorMessage);
      onError?.('reactivate', error as Error);
      
      return { success: false, error };
    } finally {
      setLoading(null);
    }
  }, [onOptimisticUpdate, onRollback, onSuccess, onError]);

  const openPortal = useCallback(async () => {
    setLoading('portal');
    
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-session');
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No se recibió URL del portal');
      }
      
      return { success: true };
    } catch (error) {
      console.error('[useSubscriptionActions] Portal error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Error al abrir el portal';
      toast.error(errorMessage);
      onError?.('portal', error as Error);
      
      return { success: false, error };
    } finally {
      setLoading(null);
    }
  }, [onError]);

  return {
    cancel,
    reactivate,
    openPortal,
    loading,
    isLoading: loading !== null,
    isCanceling: loading === 'cancel',
    isReactivating: loading === 'reactivate',
    isOpeningPortal: loading === 'portal',
  };
}
