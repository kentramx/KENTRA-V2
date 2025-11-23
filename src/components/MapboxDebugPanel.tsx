/**
 * Panel de diagnóstico visual para Mapbox (DEV only)
 * Muestra métricas en tiempo real y permite copiar diagnóstico completo
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bug, Copy, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface MapboxDebugData {
  // Map initialization
  mapInitStatus: {
    didInit: boolean;
    mapExists: boolean;
    styleLoaded: boolean;
  };
  
  // Token info
  tokenInfo: {
    envKeyUsed: string;
    tokenLength: number;
  };
  
  // Worker fix
  workerFixEnabled: boolean;
  
  // Viewport state
  viewport: {
    boundsKey: string | null;
    zoom: number;
    bounds: {
      minLat: number;
      maxLat: number;
      minLng: number;
      maxLng: number;
    } | null;
  };
  
  // Data counts
  counts: {
    properties: number;
    clusters: number;
    hasTooManyResults: boolean;
  };
  
  // Performance
  performance: {
    lastTilesLoadMs: number | null;
  };
  
  // Errors
  errors: {
    lastMapboxError: string | null;
    lastTilesError: string | null;
  };
}

interface MapboxDebugPanelProps {
  data: MapboxDebugData;
}

export const MapboxDebugPanel: React.FC<MapboxDebugPanelProps> = ({ data }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopyDiagnostic = async () => {
    const diagnostic = {
      timestamp: new Date().toISOString(),
      component: 'SearchMapMapboxV2',
      ...data,
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(diagnostic, null, 2));
      setCopied(true);
      toast({
        title: 'Diagnóstico copiado',
        description: 'Pega el contenido en el chat con el desarrollador',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo copiar al portapapeles',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      {/* Botón flotante discreto */}
      <Button
        variant="outline"
        size="icon"
        className="absolute bottom-4 right-4 z-50 h-10 w-10 rounded-full shadow-lg bg-background/95 backdrop-blur-sm border-2"
        onClick={() => setOpen(true)}
        title="Abrir panel de diagnóstico Mapbox"
      >
        <Bug className="h-5 w-5 text-primary" />
      </Button>

      {/* Dialog con diagnóstico completo */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5 text-primary" />
              Diagnóstico Mapbox V2
            </DialogTitle>
            <DialogDescription>
              Información técnica para diagnóstico y debugging
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-4">
              {/* Map Status */}
              <div>
                <h3 className="font-semibold mb-2">Estado del Mapa</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Inicializado:</span>
                    <Badge variant={data.mapInitStatus.didInit ? 'default' : 'destructive'}>
                      {String(data.mapInitStatus.didInit)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Instancia existe:</span>
                    <Badge variant={data.mapInitStatus.mapExists ? 'default' : 'destructive'}>
                      {String(data.mapInitStatus.mapExists)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Estilo cargado:</span>
                    <Badge variant={data.mapInitStatus.styleLoaded ? 'default' : 'secondary'}>
                      {String(data.mapInitStatus.styleLoaded)}
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Token Info */}
              <div>
                <h3 className="font-semibold mb-2">Token Configuration</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Variable ENV:</span>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {data.tokenInfo.envKeyUsed || 'none'}
                    </code>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Token Length:</span>
                    <Badge variant={data.tokenInfo.tokenLength > 0 ? 'default' : 'destructive'}>
                      {data.tokenInfo.tokenLength}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Worker Fix:</span>
                    <Badge variant={data.workerFixEnabled ? 'default' : 'destructive'}>
                      {String(data.workerFixEnabled)}
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Viewport Info */}
              <div>
                <h3 className="font-semibold mb-2">Viewport</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Zoom:</span>
                    <span className="font-mono">{data.viewport.zoom}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Bounds Key:</span>
                    <span className="font-mono text-xs">
                      {data.viewport.boundsKey || 'null'}
                    </span>
                  </div>
                  {data.viewport.bounds && (
                    <div className="mt-2 p-2 bg-muted rounded text-xs font-mono">
                      <div>minLat: {data.viewport.bounds.minLat.toFixed(4)}</div>
                      <div>maxLat: {data.viewport.bounds.maxLat.toFixed(4)}</div>
                      <div>minLng: {data.viewport.bounds.minLng.toFixed(4)}</div>
                      <div>maxLng: {data.viewport.bounds.maxLng.toFixed(4)}</div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Data Counts */}
              <div>
                <h3 className="font-semibold mb-2">Datos Cargados</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Propiedades:</span>
                    <Badge variant="outline">{data.counts.properties}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Clusters:</span>
                    <Badge variant="outline">{data.counts.clusters}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tile saturado:</span>
                    <Badge variant={data.counts.hasTooManyResults ? 'destructive' : 'default'}>
                      {String(data.counts.hasTooManyResults)}
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Performance */}
              <div>
                <h3 className="font-semibold mb-2">Performance</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Última carga de tiles:</span>
                    <Badge variant="outline">
                      {data.performance.lastTilesLoadMs 
                        ? `${data.performance.lastTilesLoadMs}ms` 
                        : 'N/A'}
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Errors */}
              {(data.errors.lastMapboxError || data.errors.lastTilesError) && (
                <>
                  <div>
                    <h3 className="font-semibold mb-2 text-destructive">Errores</h3>
                    <div className="space-y-2">
                      {data.errors.lastMapboxError && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Mapbox:</div>
                          <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive break-words">
                            {data.errors.lastMapboxError}
                          </div>
                        </div>
                      )}
                      {data.errors.lastTilesError && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Tiles:</div>
                          <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive break-words">
                            {data.errors.lastTilesError}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <Separator />
                </>
              )}
            </div>
          </ScrollArea>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleCopyDiagnostic}
            >
              {copied ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar diagnóstico completo
                </>
              )}
            </Button>
            <Button onClick={() => setOpen(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
