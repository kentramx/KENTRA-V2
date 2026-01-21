import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { invokeWithTimeout } from '@/utils/supabaseHelpers';

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
      // SECURITY: Use timeout to prevent indefinite hang
      const { data, error } = await invokeWithTimeout('cancel-subscription', { timeout: 30000 });

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
      // SECURITY: Use timeout to prevent indefinite hang
      const { data, error } = await invokeWithTimeout('reactivate-subscription', { timeout: 30000 });

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
      // SECURITY: Use timeout to prevent indefinite hang
      const { data, error } = await invokeWithTimeout('create-portal-session', { timeout: 30000 });

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
