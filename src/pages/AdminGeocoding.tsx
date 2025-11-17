import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MapPin, RefreshCw, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function AdminGeocoding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<{
    total: number;
    withCoords: number;
    withoutCoords: number;
  } | null>(null);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    geocoded?: number;
    failed?: number;
    total?: number;
  } | null>(null);

  useEffect(() => {
    checkAdminAccess();
    loadStats();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/');
      return;
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isSuperAdmin = roles?.some(r => r.role === 'super_admin');
    if (!isSuperAdmin) {
      navigate('/');
      toast({
        title: "Acceso denegado",
        description: "Solo super admins pueden acceder a esta funcionalidad",
        variant: "destructive",
      });
    }
  };

  const loadStats = async () => {
    // Contar total de propiedades activas
    const { count: totalCount, error: totalError } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'activa');

    // Contar propiedades con coordenadas
    const { count: withCoordsCount, error: coordsError } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'activa')
      .not('lat', 'is', null)
      .not('lng', 'is', null);

    if (totalError || coordsError) {
      console.error('Error loading stats:', totalError || coordsError);
      return;
    }

    const total = totalCount || 0;
    const withCoords = withCoordsCount || 0;

    setStats({
      total,
      withCoords,
      withoutCoords: total - withCoords,
    });
  };

  const handleGeocode = async () => {
    setIsLoading(true);
    setLastResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('geocode-existing-properties', {
        body: {},
      });

      if (error) throw error;

      setLastResult(data);
      
      toast({
        title: "Geocodificación completada",
        description: `✅ ${data.geocoded} exitosas, ❌ ${data.failed} fallidas de ${data.total} procesadas`,
      });

      // Recargar estadísticas
      await loadStats();
    } catch (error: any) {
      console.error('Geocoding error:', error);
      toast({
        title: "Error al geocodificar",
        description: error.message || "Ocurrió un error al procesar las propiedades",
        variant: "destructive",
      });
      setLastResult({ success: false });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Geocodificación Masiva</h1>
          <p className="text-muted-foreground">
            Procesa hasta 500 propiedades por ejecución con Google Geocoding API
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Propiedades
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.total || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Con Coordenadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats?.withCoords || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Sin Coordenadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">{stats?.withoutCoords || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Action Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Ejecutar Geocodificación
            </CardTitle>
            <CardDescription>
              Procesa propiedades activas sin coordenadas usando Google Maps Geocoding API.
              El sistema geocodifica basándose en colonia, municipio y estado, agregando variación
              aleatoria de ±500 metros para distribuir propiedades de la misma ubicación.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats && stats.withoutCoords > 0 ? (
              <>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Propiedades pendientes</AlertTitle>
                  <AlertDescription>
                    Hay {stats.withoutCoords} propiedades sin geocodificar. 
                    Se procesarán hasta 500 por ejecución.
                    {stats.withoutCoords > 500 && (
                      <span className="block mt-2 text-amber-600 font-medium">
                        Necesitarás ejecutar el proceso {Math.ceil(stats.withoutCoords / 500)} veces para completar todas.
                      </span>
                    )}
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={handleGeocode}
                  disabled={isLoading}
                  size="lg"
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Geocodificando... (esto puede tardar 5-10 segundos)
                    </>
                  ) : (
                    <>
                      <MapPin className="mr-2 h-5 w-5" />
                      Ejecutar Geocodificación (hasta 50 propiedades)
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle>Todo al día</AlertTitle>
                <AlertDescription>
                  Todas las propiedades activas tienen coordenadas. No hay propiedades pendientes de geocodificar.
                </AlertDescription>
              </Alert>
            )}

            {lastResult && (
              <Alert variant={lastResult.success ? "default" : "destructive"}>
                {lastResult.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertTitle>
                  {lastResult.success ? "Proceso completado" : "Error en el proceso"}
                </AlertTitle>
                <AlertDescription>
                  {lastResult.success ? (
                    <div className="space-y-1">
                      <p>✅ Exitosas: {lastResult.geocoded}</p>
                      <p>❌ Fallidas: {lastResult.failed}</p>
                      <p>📊 Total procesadas: {lastResult.total}</p>
                      {stats && stats.withoutCoords > 0 && (
                        <p className="mt-2 text-amber-600 font-medium">
                          Quedan {stats.withoutCoords} propiedades pendientes. Ejecuta nuevamente para continuar.
                        </p>
                      )}
                    </div>
                  ) : (
                    "Ocurrió un error al procesar las propiedades"
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">ℹ️ Información del Sistema</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p><strong>Geocodificación automática:</strong> Las nuevas propiedades se geocodifican automáticamente al crearse.</p>
            <p><strong>Cron job:</strong> Ejecuta diariamente a las 4 AM procesando 500 propiedades/día.</p>
            <p><strong>Variación espacial:</strong> ±500 metros para evitar marcadores apilados en la misma ubicación exacta.</p>
            <p><strong>Rate limit:</strong> Delay de 100ms entre requests para respetar límites de Google Maps API.</p>
          </CardContent>
        </Card>

        <Button
          variant="outline"
          onClick={loadStats}
          className="w-full"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar Estadísticas
        </Button>
      </div>
    </div>
  );
}
