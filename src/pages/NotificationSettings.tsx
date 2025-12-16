import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, Bell, Mail, Smartphone, ArrowLeft } from 'lucide-react';

interface NotificationPreferences {
  email_new_messages: boolean;
  email_new_properties: boolean;
  email_price_changes: boolean;
  email_saved_searches: boolean;
  email_weekly_digest: boolean;
  push_new_messages: boolean;
  push_new_properties: boolean;
  push_price_changes: boolean;
}

const NotificationSettings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email_new_messages: true,
    email_new_properties: false,
    email_price_changes: false,
    email_saved_searches: true,
    email_weekly_digest: false,
    push_new_messages: true,
    push_new_properties: false,
    push_price_changes: false,
  });

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    fetchPreferences();
  }, [user, navigate]);

  const fetchPreferences = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        // Si no existen preferencias, crear unas por defecto
        if (error.code === 'PGRST116') {
          await createDefaultPreferences();
        } else {
          throw error;
        }
      } else {
        setPreferences({
          email_new_messages: data.email_new_messages,
          email_new_properties: data.email_new_properties,
          email_price_changes: data.email_price_changes,
          email_saved_searches: data.email_saved_searches,
          email_weekly_digest: data.email_weekly_digest,
          push_new_messages: data.push_new_messages,
          push_new_properties: data.push_new_properties,
          push_price_changes: data.push_price_changes,
        });
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
      toast.error('Error al cargar las preferencias');
    } finally {
      setLoading(false);
    }
  };

  const createDefaultPreferences = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notification_preferences')
        .insert({ user_id: user.id });

      if (error) throw error;
    } catch (error) {
      console.error('Error creating default preferences:', error);
    }
  };

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          ...preferences,
        });

      if (error) throw error;

      // También actualizar el campo email_notifications en profiles
      await supabase
        .from('profiles')
        .update({
          email_notifications: Object.values(preferences).some(v => v && typeof v === 'boolean'),
        })
        .eq('id', user.id);

      toast.success('Preferencias actualizadas correctamente');
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Error al guardar las preferencias');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-6 md:py-8 pb-24 md:pb-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/perfil')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al Perfil
        </Button>

        <div className="max-w-3xl mx-auto">
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
              <Bell className="h-6 w-6 md:h-8 md:w-8 text-primary" />
              Configuración de Notificaciones
            </h1>
            <p className="text-muted-foreground mt-2">
              Personaliza cómo y cuándo quieres recibir notificaciones
            </p>
          </div>

          <div className="space-y-6">
            {/* Notificaciones por Email */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  Notificaciones por Email
                </CardTitle>
                <CardDescription>
                  Recibe actualizaciones importantes directamente en tu correo electrónico
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-messages" className="text-base">
                      Nuevos mensajes
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Recibe un email cuando alguien te envíe un mensaje
                    </p>
                  </div>
                  <Switch
                    id="email-messages"
                    checked={preferences.email_new_messages}
                    onCheckedChange={() => handleToggle('email_new_messages')}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-properties" className="text-base">
                      Nuevas propiedades
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Notificación cuando se publiquen propiedades que coincidan con tus búsquedas
                    </p>
                  </div>
                  <Switch
                    id="email-properties"
                    checked={preferences.email_new_properties}
                    onCheckedChange={() => handleToggle('email_new_properties')}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-prices" className="text-base">
                      Cambios de precio
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Alerta cuando cambien los precios de tus propiedades favoritas
                    </p>
                  </div>
                  <Switch
                    id="email-prices"
                    checked={preferences.email_price_changes}
                    onCheckedChange={() => handleToggle('email_price_changes')}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-searches" className="text-base">
                      Búsquedas guardadas
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Resultados de tus búsquedas guardadas
                    </p>
                  </div>
                  <Switch
                    id="email-searches"
                    checked={preferences.email_saved_searches}
                    onCheckedChange={() => handleToggle('email_saved_searches')}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-digest" className="text-base">
                      Resumen semanal
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Recibe un resumen semanal de actividad y nuevas propiedades
                    </p>
                  </div>
                  <Switch
                    id="email-digest"
                    checked={preferences.email_weekly_digest}
                    onCheckedChange={() => handleToggle('email_weekly_digest')}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Notificaciones Push */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-primary" />
                  Notificaciones Push
                </CardTitle>
                <CardDescription>
                  Recibe notificaciones instantáneas en tu dispositivo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="push-messages" className="text-base">
                      Nuevos mensajes
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Notificación instantánea cuando recibas un mensaje
                    </p>
                  </div>
                  <Switch
                    id="push-messages"
                    checked={preferences.push_new_messages}
                    onCheckedChange={() => handleToggle('push_new_messages')}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="push-properties" className="text-base">
                      Nuevas propiedades
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Alerta cuando se publiquen propiedades relevantes
                    </p>
                  </div>
                  <Switch
                    id="push-properties"
                    checked={preferences.push_new_properties}
                    onCheckedChange={() => handleToggle('push_new_properties')}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="push-prices" className="text-base">
                      Cambios de precio
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Notificación instantánea de cambios de precio
                    </p>
                  </div>
                  <Switch
                    id="push-prices"
                    checked={preferences.push_price_changes}
                    onCheckedChange={() => handleToggle('push_price_changes')}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
              <Button
                variant="outline"
                onClick={() => navigate('/perfil')}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar Cambios'
                )}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default NotificationSettings;
