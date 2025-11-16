import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Bell, TrendingUp, TrendingDown, Shield, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface RealtimeNotification {
  id: string;
  type: 'bypass' | 'upgrade' | 'downgrade' | 'unusual';
  message: string;
  timestamp: string;
  metadata: any;
  read: boolean;
}

interface AdminRealtimeNotificationsProps {
  userId: string;
  isAdmin: boolean;
}

interface NotificationPreferences {
  notify_on_bypass: boolean;
  notify_on_upgrade: boolean;
  notify_on_downgrade: boolean;
  use_toast: boolean;
  use_sound: boolean;
  use_email: boolean;
}

export const AdminRealtimeNotifications = ({ userId, isAdmin }: AdminRealtimeNotificationsProps) => {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    notify_on_bypass: true,
    notify_on_upgrade: true,
    notify_on_downgrade: false,
    use_toast: true,
    use_sound: false,
    use_email: false,
  });
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAdmin) return;

    const fetchPreferences = async () => {
      const { data } = await supabase
        .from('admin_notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (data) {
        setPreferences({
          notify_on_bypass: data.notify_on_bypass,
          notify_on_upgrade: data.notify_on_upgrade,
          notify_on_downgrade: data.notify_on_downgrade,
          use_toast: data.use_toast,
          use_sound: data.use_sound,
          use_email: data.use_email,
        });
      }
    };

    fetchPreferences();
  }, [isAdmin, userId]);

  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel('subscription-changes-admin')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'subscription_changes',
        },
        async (payload) => {
          await handleNewChange(payload.new as any);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  useEffect(() => {
    setUnreadCount(notifications.filter(n => !n.read).length);
  }, [notifications]);

  const playNotificationSound = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZSA0PVq/m7qxdGAg+ltzy');
    audio.volume = 0.3;
    audio.play().catch(() => {});
  };

  const sendEmailNotification = async (
    notificationType: 'bypass' | 'upgrade' | 'downgrade',
    userName: string,
    planName: string,
    timestamp: string,
    isAdminChange: boolean = false
  ) => {
    try {
      // Get admin user email from auth
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.email) {
        return;
      }

      // Get admin name from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', userId)
        .single();

      const { error } = await supabase.functions.invoke('send-admin-notification-email', {
        body: {
          adminEmail: user.email,
          adminName: profile?.name || 'Administrador',
          notificationType,
          userName,
          planName,
          timestamp,
          isAdminChange,
        },
      });

      if (error) {
        console.error('Error sending email notification:', error);
      }
    } catch (error) {
      console.error('Error in sendEmailNotification:', error);
    }
  };

  const handleNewChange = async (change: any) => {
    const metadata = change.metadata || {};
    
    // Determinar si es un evento importante
    const isBypassed = metadata.bypassed_cooldown === true;
    const isAdminChange = metadata.changed_by_admin === true;
    
    // Verificar si el tipo de evento está habilitado en preferencias
    const shouldNotify = 
      (isBypassed && preferences.notify_on_bypass) ||
      (change.change_type === 'upgrade' && preferences.notify_on_upgrade) ||
      (change.change_type === 'downgrade' && preferences.notify_on_downgrade);

    if (!shouldNotify) return;

    // Obtener nombre del usuario
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', change.user_id)
      .single();

    const userName = profile?.name || 'Usuario desconocido';
    const planName = metadata.new_plan_name || 'Plan desconocido';
    
    let notification: RealtimeNotification | null = null;

    // Bypass de cooldown
    if (isBypassed) {
      notification = {
        id: change.id,
        type: 'bypass',
        message: `${isAdminChange ? 'Admin forzó' : 'Bypass detectado'} cambio de plan para ${userName} a ${planName}`,
        timestamp: change.changed_at,
        metadata: change,
        read: false,
      };

      if (preferences.use_toast) {
        toast({
          title: '⚠️ Bypass de Cooldown Detectado',
          description: notification.message,
          duration: 8000,
        });
      }
    }
    // Upgrade significativo
    else if (change.change_type === 'upgrade') {
      notification = {
        id: change.id,
        type: 'upgrade',
        message: `${userName} mejoró a ${planName}`,
        timestamp: change.changed_at,
        metadata: change,
        read: false,
      };

      if (preferences.use_toast) {
        toast({
          title: '📈 Nuevo Upgrade',
          description: notification.message,
          duration: 5000,
        });
      }
    }
    // Downgrade (puede indicar problema)
    else if (change.change_type === 'downgrade') {
      notification = {
        id: change.id,
        type: 'downgrade',
        message: `${userName} bajó a ${planName}`,
        timestamp: change.changed_at,
        metadata: change,
        read: false,
      };
    }

    if (notification) {
      setNotifications(prev => [notification!, ...prev].slice(0, 20));
      
      // Reproducir sonido si está habilitado
      if (preferences.use_sound) {
        playNotificationSound();
      }

      // Enviar email si está habilitado (solo para bypass, upgrade, downgrade)
      if (preferences.use_email && notification.type !== 'unusual') {
        sendEmailNotification(
          notification.type as 'bypass' | 'upgrade' | 'downgrade',
          userName,
          planName,
          notification.timestamp,
          isAdminChange
        );
      }
    }
  };

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'bypass':
        return <Shield className="h-4 w-4 text-purple-600" />;
      case 'upgrade':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'downgrade':
        return <TrendingDown className="h-4 w-4 text-amber-600" />;
      case 'unusual':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  if (!isAdmin) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-600 text-white text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Notificaciones Admin</h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin/notification-settings')}
            className="h-8 w-8"
          >
            <Bell className="h-4 w-4" />
          </Button>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs"
              >
                Marcar todo leído
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="text-xs"
              >
                Limpiar
              </Button>
            )}
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No hay notificaciones recientes</p>
              <p className="text-xs mt-1">
                Te notificaremos cuando ocurran cambios importantes
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-muted/50 transition-colors cursor-pointer ${
                    !notification.read ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    {getNotificationIcon(notification.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium break-words">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(notification.timestamp), "d MMM yyyy, HH:mm", { locale: es })}
                      </p>
                      {notification.type === 'bypass' && (
                        <Badge variant="outline" className="mt-2 border-purple-500 text-purple-700">
                          <Shield className="h-3 w-3 mr-1" />
                          Bypass de Cooldown
                        </Badge>
                      )}
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {notifications.length > 0 && (
          <div className="p-3 border-t bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => navigate('/admin/subscription-changes')}
            >
              Ver todas las auditorías →
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
