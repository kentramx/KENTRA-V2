import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { MapPin, RefreshCw, AlertTriangle, CheckCircle2, Info, Loader2, ChevronDown, Play, Square } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';

interface Stats {
  total: number;
  withCoords: number;
  withoutCoords: number;
}

interface LastResult {
  geocoded: number;
  failed: number;
  cacheHits?: number;
  fallbackGeocoded?: number;
  retries?: number;
  total: number;
  executionMs?: number;
}

export default function AdminGeocoding() {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [stats, setStats] = useState<Stats>({ total: 0, withCoords: 0, withoutCoords: 0 });
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  
  // Parámetros avanzados
  const [limit, setLimit] = useState('1000');
  const [batchSize, setBatchSize] = useState('10');
  const [dryRun, setDryRun] = useState(false);
  const [autoRunLimit, setAutoRunLimit] = useState(5); // Máximo de ciclos
  const [autoRunCycles, setAutoRunCycles] = useState(0);

  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminAccess();
    loadStats();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const isSuperAdmin = roles?.some(r => r.role === 'super_admin');
      
      if (!isSuperAdmin) {
        toast({
          variant: "destructive",
          title: "Acceso denegado",
          description: "Solo super administradores pueden acceder a esta página",
        });
        navigate('/');
        return;
      }

      setLoading(false);
    } catch (error) {
      console.error('Error checking access:', error);
      navigate('/');
    }
  };

  const loadStats = async () => {
    try {
      // Contar total de propiedades
      const { count: totalCount, error: totalError } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true });

      // Contar propiedades con coordenadas
      const { count: withCoordsCount, error: coordsError } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .not('lat', 'is', null)
        .not('lng', 'is', null);

      if (totalError || coordsError) {
        throw new Error('Error loading stats');
      }

      setStats({
        total: totalCount || 0,
        withCoords: withCoordsCount || 0,
        withoutCoords: (totalCount || 0) - (withCoordsCount || 0),
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar las estadísticas",
      });
    }
  };

  const handleGeocode = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('geocode-existing-properties', {
        body: {
          limit: parseInt(limit),
          batchSize: parseInt(batchSize),
          dryRun,
        }
      });

      if (error) throw error;

      setLastResult(data);

      if (dryRun) {
        toast({
          title: "Estimación completada",
          description: `${data.total} propiedades procesables. ${data.potentialCacheHits} desde caché, ${data.potentialApiCalls} llamadas API necesarias.`,
        });
      } else {
        toast({
          title: "Geocodificación completada",
          description: `${data.geocoded} propiedades geocodificadas exitosamente. ${data.failed} fallidas. ${data.cacheHits || 0} desde caché.`,
        });
      }

      // Recargar estadísticas
      await loadStats();
    } catch (error: any) {
      console.error('Error geocoding:', error);
      toast({
        variant: "destructive",
        title: "Error en geocodificación",
        description: error.message || "Ocurrió un error durante la geocodificación",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleAutoRun = async () => {
    setAutoRunning(true);
    setAutoRunCycles(0);
    
    try {
      let cycles = 0;
      let remainingProps = stats.withoutCoords;

      while (remainingProps > 0 && cycles < autoRunLimit) {
        cycles++;
        setAutoRunCycles(cycles);

        const { data, error } = await supabase.functions.invoke('geocode-existing-properties', {
          body: {
            limit: parseInt(limit),
            batchSize: parseInt(batchSize),
          }
        });

        if (error) throw error;

        setLastResult(data);
        remainingProps = remainingProps - data.geocoded;

        // Recargar estadísticas
        await loadStats();

        // Si no se geocodificó nada, terminar
        if (data.geocoded === 0) {
          break;
        }

        // Pequeño delay entre ciclos
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      toast({
        title: "Auto-ejecución completada",
        description: `Completados ${cycles} ciclos. ${stats.withoutCoords} propiedades restantes.`,
      });
    } catch (error: any) {
      console.error('Error en auto-run:', error);
      toast({
        variant: "destructive",
        title: "Error en auto-ejecución",
        description: error.message,
      });
    } finally {
      setAutoRunning(false);
      setAutoRunCycles(0);
    }
  };

  const stopAutoRun = () => {
    setAutoRunning(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const progress = stats.total > 0 ? (stats.withCoords / stats.total) * 100 : 0;

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Geocodificación Masiva</h1>
          <p className="text-muted-foreground">
            Procesa hasta {limit} propiedades por ejecución (lotes paralelos) con Google Geocoding API
          </p>
        </div>

        <Button
          variant="outline"
          onClick={loadStats}
          disabled={processing || autoRunning}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar Stats
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Propiedades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Con Coordenadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.withCoords}</div>
            <Progress value={progress} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">{progress.toFixed(1)}% completado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sin Coordenadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">{stats.withoutCoords}</div>
            {stats.withoutCoords > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                ~{Math.ceil(stats.withoutCoords / parseInt(limit))} ejecuciones necesarias
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Controles Avanzados */}
      <Card>
        <CardHeader>
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <CardTitle>Controles Avanzados</CardTitle>
                <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Límite por ejecución</Label>
                  <Select value={limit} onValueChange={setLimit}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="200">200 propiedades</SelectItem>
                      <SelectItem value="500">500 propiedades</SelectItem>
                      <SelectItem value="1000">1000 propiedades</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Paralelismo (lote)</Label>
                  <Select value={batchSize} onValueChange={setBatchSize}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 paralelos</SelectItem>
                      <SelectItem value="10">10 paralelos</SelectItem>
                      <SelectItem value="15">15 paralelos</SelectItem>
                      <SelectItem value="20">20 paralelos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Ciclos auto-run (máx)</Label>
                  <Select value={autoRunLimit.toString()} onValueChange={(v) => setAutoRunLimit(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 ciclos</SelectItem>
                      <SelectItem value="5">5 ciclos</SelectItem>
                      <SelectItem value="10">10 ciclos</SelectItem>
                      <SelectItem value="20">20 ciclos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox id="dryRun" checked={dryRun} onCheckedChange={(checked) => setDryRun(checked as boolean)} />
                <Label htmlFor="dryRun" className="text-sm font-normal">
                  Dry run (estimación sin escribir cambios)
                </Label>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardHeader>
      </Card>

      {/* Acción Principal */}
      <Card>
        <CardHeader>
          <CardTitle>Ejecutar Geocodificación</CardTitle>
          <CardDescription>
            Procesa propiedades sin coordenadas usando Google Maps Geocoding API.
            El sistema geocodifica basándose en colonia, municipio y estado, agregando variación
            aleatoria de ±500 metros para distribuir propiedades de la misma ubicación.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {stats.withoutCoords > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Propiedades pendientes</AlertTitle>
              <AlertDescription>
                Hay {stats.withoutCoords} propiedades sin geocodificar. 
                Se procesarán hasta {limit} por ejecución.
                {stats.withoutCoords > parseInt(limit) && (
                  <span className="block mt-2 text-amber-600 font-medium">
                    Necesitarás ejecutar el proceso {Math.ceil(stats.withoutCoords / parseInt(limit))} veces para completar todas.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button
              onClick={handleGeocode}
              disabled={processing || autoRunning || stats.withoutCoords === 0}
              className="flex-1"
              size="lg"
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <MapPin className="mr-2 h-5 w-5" />
                  Ejecutar Geocodificación ({limit} propiedades)
                </>
              )}
            </Button>

            {!autoRunning ? (
              <Button
                onClick={handleAutoRun}
                disabled={processing || stats.withoutCoords === 0}
                variant="secondary"
                size="lg"
              >
                <Play className="mr-2 h-5 w-5" />
                Auto-ejecutar
              </Button>
            ) : (
              <Button
                onClick={stopAutoRun}
                variant="destructive"
                size="lg"
              >
                <Square className="mr-2 h-5 w-5" />
                Detener ({autoRunCycles}/{autoRunLimit})
              </Button>
            )}
          </div>

          {autoRunning && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Ciclo {autoRunCycles} de {autoRunLimit}</span>
                <span>{stats.withoutCoords} restantes</span>
              </div>
              <Progress value={(autoRunCycles / autoRunLimit) * 100} />
            </div>
          )}

          {lastResult && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Última ejecución</AlertTitle>
              <AlertDescription>
                <div className="space-y-1 mt-2">
                  <p><strong>Geocodificadas:</strong> {lastResult.geocoded} de {lastResult.total}</p>
                  {lastResult.cacheHits !== undefined && lastResult.cacheHits > 0 && (
                    <p><strong>Desde caché:</strong> {lastResult.cacheHits} (evitó llamadas API)</p>
                  )}
                  {lastResult.fallbackGeocoded !== undefined && lastResult.fallbackGeocoded > 0 && (
                    <p><strong>Con fallback:</strong> {lastResult.fallbackGeocoded} (sin colonia)</p>
                  )}
                  {lastResult.failed > 0 && (
                    <p className="text-destructive"><strong>Fallidas:</strong> {lastResult.failed}</p>
                  )}
                  {lastResult.executionMs && (
                    <p className="text-muted-foreground text-xs">
                      Tiempo de ejecución: {(lastResult.executionMs / 1000).toFixed(2)}s
                    </p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Información del Sistema */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Información del Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p><strong>Geocodificación automática:</strong> Las nuevas propiedades se geocodifican automáticamente al crearse.</p>
          <p><strong>Caché inteligente:</strong> Las ubicaciones se almacenan en caché para reducir llamadas a Google API.</p>
          <p><strong>Cron job:</strong> Ejecuta diariamente a las 4 AM procesando hasta {limit} propiedades/día (lotes paralelos).</p>
          <p><strong>Variación espacial:</strong> ±500 metros para evitar marcadores apilados en la misma ubicación exacta.</p>
          <p><strong>Fallback inteligente:</strong> Si falla con colonia, reintenta solo con municipio y estado.</p>
          <p><strong>Rate limit:</strong> Lotes de {batchSize} en paralelo con backoff exponencial para respetar límites de Google Maps API.</p>
          <p className="text-xs opacity-70 mt-4">Geocoding UI v1.3 • Función v2.0</p>
        </CardContent>
      </Card>
    </div>
  );
}