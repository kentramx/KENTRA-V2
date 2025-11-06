import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Bell, X } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';

export const NotificationPermissionBanner = () => {
  const { permission, isSupported, requestPermission } = useNotifications();
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Verificar si el banner ya fue cerrado en esta sesión
    const dismissed = sessionStorage.getItem('notificationBannerDismissed');
    if (dismissed) {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('notificationBannerDismissed', 'true');
  };

  const handleEnable = async () => {
    const granted = await requestPermission();
    if (granted) {
      handleDismiss();
    }
  };

  // No mostrar si:
  // - No está soportado
  // - Ya fue concedido
  // - Fue explícitamente denegado
  // - El usuario cerró el banner
  if (!isSupported || permission === 'granted' || permission === 'denied' || isDismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-md">
      <Alert className="shadow-lg border-primary/50">
        <Bell className="h-4 w-4" />
        <AlertTitle className="flex items-center justify-between">
          <span>Activa las notificaciones</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 -mr-2"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </AlertTitle>
        <AlertDescription className="mt-2">
          <p className="text-sm mb-3">
            Recibe notificaciones cuando lleguen mensajes nuevos, incluso si la app está en segundo plano.
          </p>
          <Button onClick={handleEnable} className="w-full" size="sm">
            <Bell className="h-4 w-4 mr-2" />
            Activar notificaciones
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
};
