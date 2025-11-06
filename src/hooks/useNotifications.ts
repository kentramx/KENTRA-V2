import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export const useNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Verificar si las notificaciones están soportadas
    setIsSupported('Notification' in window && 'serviceWorker' in navigator);
    
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!isSupported) {
      toast.error('Tu navegador no soporta notificaciones push');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        toast.success('Notificaciones activadas correctamente');
        return true;
      } else if (result === 'denied') {
        toast.error('Notificaciones bloqueadas. Actívalas en la configuración del navegador.');
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('Error al solicitar permisos de notificación');
      return false;
    }
  };

  const showNotification = async (title: string, options?: NotificationOptions) => {
    if (!isSupported) return;

    // Si no tenemos permiso, no mostrar nada
    if (permission !== 'granted') {
      return;
    }

    try {
      // Verificar si hay un service worker activo
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        
        // Usar la API de Service Worker para mostrar la notificación
        await registration.showNotification(title, {
          icon: '/pwa-192x192.png',
          badge: '/favicon.ico',
          tag: 'message-notification',
          ...options,
        });
      } else {
        // Fallback a la API normal de Notification
        new Notification(title, {
          icon: '/pwa-192x192.png',
          badge: '/favicon.ico',
          ...options,
        });
      }
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  };

  return {
    permission,
    isSupported,
    requestPermission,
    showNotification,
  };
};
