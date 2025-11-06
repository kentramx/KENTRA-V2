import { useEffect, useState } from 'react';
import { addToQueue, getPendingMessages, removeFromQueue, countPendingMessages, PendingMessage } from '@/utils/messageQueue';

interface SyncManager {
  register(tag: string): Promise<void>;
  getTags(): Promise<string[]>;
}

interface ServiceWorkerRegistrationWithSync extends ServiceWorkerRegistration {
  sync?: SyncManager;
}

export const useBackgroundSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Actualizar estado de conexión
    const handleOnline = () => {
      setIsOnline(true);
      console.log('Conexión restablecida, iniciando sincronización...');
      requestBackgroundSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('Conexión perdida');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Actualizar conteo inicial
    updatePendingCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const updatePendingCount = async () => {
    try {
      const count = await countPendingMessages();
      setPendingCount(count);
    } catch (error) {
      console.error('Error actualizando conteo de mensajes pendientes:', error);
    }
  };

  const requestBackgroundSync = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready as ServiceWorkerRegistrationWithSync;
        
        // Verificar si el navegador soporta Background Sync
        if (registration.sync) {
          await registration.sync.register('sync-messages');
          console.log('Background sync registrado');
        } else {
          // Fallback: sincronizar directamente si no hay soporte
          console.log('Background Sync no soportado, sincronizando directamente');
          await syncNow();
        }
      } catch (error) {
        console.error('Error registrando background sync:', error);
        // Fallback: intentar sincronizar directamente
        await syncNow();
      }
    } else {
      console.log('Service Worker no disponible, sincronizando directamente');
      await syncNow();
    }
  };

  const syncNow = async () => {
    if (isSyncing || !isOnline) return;

    setIsSyncing(true);
    try {
      const pendingMessages = await getPendingMessages();
      console.log(`Sincronizando ${pendingMessages.length} mensajes pendientes...`);

      // Aquí deberíamos enviar los mensajes a Supabase
      // Por ahora solo actualizamos el conteo
      await updatePendingCount();
    } catch (error) {
      console.error('Error sincronizando mensajes:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const queueMessage = async (message: Omit<PendingMessage, 'id' | 'timestamp'>) => {
    const pendingMessage: PendingMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    try {
      await addToQueue(pendingMessage);
      await updatePendingCount();
      
      // Si estamos online, intentar sincronizar inmediatamente
      if (isOnline) {
        await requestBackgroundSync();
      }

      return pendingMessage;
    } catch (error) {
      console.error('Error agregando mensaje a la cola:', error);
      throw error;
    }
  };

  const removeMessage = async (messageId: string) => {
    try {
      await removeFromQueue(messageId);
      await updatePendingCount();
    } catch (error) {
      console.error('Error eliminando mensaje de la cola:', error);
      throw error;
    }
  };

  return {
    isOnline,
    pendingCount,
    isSyncing,
    queueMessage,
    removeMessage,
    syncNow,
  };
};
