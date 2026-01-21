import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Bell, Volume2, Mail, TrendingUp, TrendingDown, Shield, Loader2 } from 'lucide-react';

interface NotificationPreferences {
  notify_on_bypass: boolean;
  notify_on_upgrade: boolean;
  notify_on_downgrade: boolean;
  use_toast: boolean;
  use_sound: boolean;
  use_email: boolean;
}

export default function AdminNotificationSettings() {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    notify_on_bypass: true,
    notify_on_upgrade: true,
    notify_on_downgrade: false,
    use_toast: true,
    use_sound: false,
    use_email: false,
  });

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate('/');
    }
  }, [isAdmin, adminLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchPreferences();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchPreferences is stable and only needs to run when isAdmin changes
  }, [isAdmin]);

  const fetchPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('admin_notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

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
    } catch (error) {
      console.error('Error fetching preferences:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las preferencias',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('admin_notification_preferences')
        .upsert({
          user_id: user.id,
          ...preferences,
        });

      if (error) throw error;

      toast({
        title: 'Guardado',
        description: 'Tus preferencias de notificación han sido actualizadas',
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron guardar las preferencias',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (adminLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="container max-w-4xl py-6 md:py-8 pb-24 md:pb-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Configuración de Notificaciones</h1>
        <p className="text-muted-foreground mt-2">
          Personaliza qué eventos quieres recibir y cómo quieres ser notificado
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Tipos de Eventos
          </CardTitle>
          <CardDescription>
            Selecciona qué cambios de suscripción quieres monitorear
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-purple-600" />
                <Label htmlFor="bypass">Bypass de Cooldown</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Notificar cuando un admin fuerza un cambio de plan
              </p>
            </div>
            <Switch
              id="bypass"
              checked={preferences.notify_on_bypass}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, notify_on_bypass: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <Label htmlFor="upgrade">Upgrades de Plan</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Notificar cuando un usuario mejora su plan
              </p>
            </div>
            <Switch
              id="upgrade"
              checked={preferences.notify_on_upgrade}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, notify_on_upgrade: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-amber-600" />
                <Label htmlFor="downgrade">Downgrades de Plan</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Notificar cuando un usuario baja su plan
              </p>
            </div>
            <Switch
              id="downgrade"
              checked={preferences.notify_on_downgrade}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, notify_on_downgrade: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Métodos de Notificación
          </CardTitle>
          <CardDescription>
            Elige cómo quieres recibir las notificaciones
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <Label htmlFor="toast">Notificaciones Toast</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Mostrar notificaciones emergentes en pantalla
              </p>
            </div>
            <Switch
              id="toast"
              checked={preferences.use_toast}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, use_toast: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-primary" />
                <Label htmlFor="sound">Alertas Sonoras</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Reproducir un sonido cuando llega una notificación
              </p>
            </div>
            <Switch
              id="sound"
              checked={preferences.use_sound}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, use_sound: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <Label htmlFor="email">Notificaciones por Email</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Recibir un correo cuando ocurre un evento importante
              </p>
            </div>
            <Switch
              id="email"
              checked={preferences.use_email}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, use_email: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}>
          Cancelar
        </Button>
        <Button onClick={savePreferences} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            'Guardar Preferencias'
          )}
        </Button>
      </div>
    </div>
  );
}
