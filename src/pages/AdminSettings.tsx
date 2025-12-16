import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Settings, DollarSign, RefreshCw, Save, Loader2, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ExchangeRateValue {
  rate: number;
  source: 'manual' | 'banxico';
  updated_at?: string;
}

interface AppSetting {
  id: string;
  key: string;
  value: ExchangeRateValue;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

const AdminSettings = () => {
  const navigate = useNavigate();
  const { isSuperAdmin, loading: adminLoading } = useAdminCheck();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [setting, setSetting] = useState<AppSetting | null>(null);
  const [newRate, setNewRate] = useState('');
  const [updatedByName, setUpdatedByName] = useState<string | null>(null);

  useEffect(() => {
    if (!adminLoading && !isSuperAdmin) {
      navigate('/');
      return;
    }
    if (!adminLoading && isSuperAdmin) {
      fetchExchangeRate();
    }
  }, [adminLoading, isSuperAdmin, navigate]);

  const fetchExchangeRate = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'exchange_rate_usd_mxn')
        .single();

      if (error) throw error;

      // Type assertion since we know the structure
      const typedData = data as unknown as AppSetting;
      setSetting(typedData);
      setNewRate(typedData.value.rate.toString());

      // Fetch updater name if exists
      if (typedData.updated_by) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', typedData.updated_by)
          .single();
        if (profile) {
          setUpdatedByName(profile.name);
        }
      }
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
      toast.error('Error al cargar el tipo de cambio');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate <= 0) {
      toast.error('Ingresa un valor válido mayor a 0');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const newValue = {
        rate,
        source: 'manual',
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('app_settings')
        .update({
          value: newValue,
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        })
        .eq('key', 'exchange_rate_usd_mxn');

      if (error) throw error;

      toast.success('Tipo de cambio actualizado correctamente');
      fetchExchangeRate();
    } catch (error) {
      console.error('Error saving exchange rate:', error);
      toast.error('Error al guardar el tipo de cambio');
    } finally {
      setSaving(false);
    }
  };

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin/dashboard')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings className="h-6 w-6" />
              Configuración del Sistema
            </h1>
            <p className="text-muted-foreground">
              Administra las configuraciones globales de Kentra
            </p>
          </div>
        </div>

        {/* Exchange Rate Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Tipo de Cambio USD/MXN
            </CardTitle>
            <CardDescription>
              Este valor se usa para filtrar propiedades por precio y convertir USD a MXN equivalente en búsquedas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Current Value Display */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Valor actual</p>
                  <p className="text-3xl font-bold">
                    ${setting?.value.rate.toFixed(2)} <span className="text-lg font-normal text-muted-foreground">MXN por USD</span>
                  </p>
                </div>
                <Badge variant={setting?.value.source === 'banxico' ? 'default' : 'secondary'}>
                  {setting?.value.source === 'banxico' ? 'Banxico' : 'Manual'}
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Edit Form */}
            <div className="space-y-4">
              <Label htmlFor="exchange-rate">Nuevo tipo de cambio</Label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="exchange-rate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={newRate}
                    onChange={(e) => setNewRate(e.target.value)}
                    className="pl-9"
                    placeholder="20.15"
                  />
                </div>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Guardar
                </Button>
              </div>
            </div>

            <Separator />

            {/* Last Update Info */}
            {setting?.updated_at && (
              <div className="text-sm text-muted-foreground space-y-1">
                <p className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Última actualización: {format(new Date(setting.updated_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
                </p>
                {updatedByName && (
                  <p className="ml-6">Por: {updatedByName}</p>
                )}
              </div>
            )}

            {/* Info Box */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>ℹ️ Uso del tipo de cambio:</strong>
              </p>
              <ul className="text-sm text-blue-700 dark:text-blue-300 mt-2 space-y-1 list-disc list-inside">
                <li>Filtrar propiedades en USD cuando el usuario busca por precio en MXN</li>
                <li>Mostrar precio equivalente en MXN para propiedades en USD</li>
                <li>Calcular estadísticas y métricas de mercado</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminSettings;
