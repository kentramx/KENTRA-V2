/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                   KENTRA MAP STACK - COMPONENTE OFICIAL                      ║
 * ║                         Mapa de Búsqueda Principal                           ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 * 
 * 📍 PROPÓSITO:
 * Este es el componente OFICIAL del mapa de búsqueda de Kentra.
 * Cualquier nueva funcionalidad relacionada con mapas en la página de búsqueda
 * DEBE integrarse aquí. No crear componentes alternativos o experimentales.
 * 
 * 🛠️ TECNOLOGÍA:
 * - Google Maps JavaScript API
 * - Arquitectura tile-based para escalabilidad (1M+ propiedades)
 * - Clustering adaptativo según zoom level
 * - Viewport-based loading con debounce
 * 
 * 🎯 CARACTERÍSTICAS:
 * - Renderizado eficiente con diffing de marcadores
 * - Manejo robusto de errores con monitoring
 * - Sincronización con lista de propiedades
 * - Preloading de tiles vecinos (desactivado temporalmente)
 * 
 * 📦 DEPENDENCIAS OFICIALES:
 * - BasicGoogleMap (componente base)
 * - useTiledMap (hook de tiles)
 * - loadGoogleMaps (loader de API)
 * 
 * ⚠️ IMPORTANTE:
 * Este componente es parte del stack de producción estable.
 * Cualquier modificación debe ser cuidadosamente testeada.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BasicGoogleMap } from '@/components/BasicGoogleMap';
import { ViewportBounds, MIN_ZOOM_FOR_TILES, MAX_PROPERTIES_PER_TILE } from '@/hooks/useTiledMap';
import type { MapProperty, PropertyFilters, PropertySummary } from '@/types/property';
import { monitoring } from '@/lib/monitoring';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// 🔧 Debug flag controlado para logs de diagnóstico
const MAP_DEBUG = typeof window !== 'undefined' && (window as any).__KENTRA_MAP_DEBUG__ === true;

interface SearchMapProps {
  properties: MapProperty[];
  clusters: { lat: number; lng: number; property_count: number; avg_price: number; cluster_id: string }[];
  isLoading: boolean;
  filters: PropertyFilters;
  searchCoordinates: { lat: number; lng: number } | null;
  onMarkerClick: (id: string) => void;
  onBoundsChanged: (bounds: ViewportBounds) => void;
  height?: string;
  onMapError?: (error: string) => void;
  onVisibleCountChange?: (count: number) => void;
  
  // 🔍 Props de debug para diagnóstico de viewport
  debugViewportReason?: string | null;
  debugViewportBounds?: ViewportBounds | null;
}

export const SearchMap: React.FC<SearchMapProps> = ({
  properties,
  clusters,
  isLoading,
  filters,
  searchCoordinates,
  onMarkerClick,
  onBoundsChanged,
  height = '100%',
  onMapError,
  onVisibleCountChange,
  debugViewportReason,
  debugViewportBounds,
}) => {
  const navigate = useNavigate();
  const [mapError, setMapError] = useState<string | null>(null);
  
  // ✅ Mantener datos previos para evitar parpadeos
  const previousMarkersRef = useRef<any[]>([]);

  // ✅ Calcular y reportar el total de propiedades visibles en el mapa
  useEffect(() => {
    if (!onVisibleCountChange) return;
    
    const totalVisible = (properties?.length || 0) + 
      (clusters?.reduce((acc, c) => acc + c.property_count, 0) || 0);
    
    onVisibleCountChange(totalVisible);
  }, [properties, clusters, onVisibleCountChange]);

  // ✅ Handler para errores críticos del mapa (Google Maps no carga)
  const handleMapError = useCallback((error: Error) => {
    const errorMsg = error.message;
    setMapError(errorMsg);
    monitoring.error('[SearchMap] Error crítico del mapa', {
      component: 'SearchMap',
      error: errorMsg,
    });
    onMapError?.(errorMsg);
  }, [onMapError]);

  // ✅ Memoizar markers - Combinar propiedades y clusters simultáneamente
  // Usa comparación primitiva para evitar recálculos innecesarios
  const mapMarkers = useMemo(() => {
    // Si está cargando y no hay datos nuevos, mantener datos previos para evitar parpadeos
    if (isLoading && properties.length === 0 && clusters.length === 0 && previousMarkersRef.current.length > 0) {
      return previousMarkersRef.current;
    }

    const markers: any[] = [];

    // 1) Agregar propiedades individuales con type: 'property'
    if (properties && properties.length > 0) {
      const propertyMarkers = properties
        .filter((p) => p.lat != null && p.lng != null)
        .map((p) => ({
          id: p.id,
          lat: Number(p.lat),
          lng: Number(p.lng),
          title: p.title,
          price: p.price,
          currency: (p.currency ?? 'MXN') as 'MXN' | 'USD',
          type: 'property' as const,
          bedrooms: p.bedrooms,
          bathrooms: p.bathrooms,
          images: p.images,
          listing_type: p.listing_type as 'venta' | 'renta',
          address: p.address,
        }));
      
      markers.push(...propertyMarkers);
    }

    // 2) Agregar clusters con type: 'cluster' y count
    if (clusters && clusters.length > 0) {
      const clusterMarkers = clusters.map((c) => ({
        id: `cluster-${c.cluster_id}`,
        lat: c.lat,
        lng: c.lng,
        title: `${c.property_count} propiedades`,
        price: c.avg_price,
        currency: 'MXN' as const,
        type: 'cluster' as const,
        count: c.property_count,
      }));
      
      markers.push(...clusterMarkers);
    }

    // Actualizar ref con nuevos markers
    if (markers.length > 0) {
      previousMarkersRef.current = markers;
    }

    return markers;
  }, [properties, clusters, isLoading]);

  // ✅ Centro del mapa
  const mapCenter = useMemo(() => {
    if (searchCoordinates) {
      return searchCoordinates;
    }
    // Centro de México por defecto
    return { lat: 23.6345, lng: -102.5528 };
  }, [searchCoordinates]);

  

  // ✅ Callback memoizado para bounds change
  const handleBoundsChange = useCallback((bounds: ViewportBounds) => {
    onBoundsChanged(bounds);
  }, [onBoundsChanged]);

  // ✅ Callback memoizado para marker click (no navegar si es cluster)
  const handleMarkerClickInternal = useCallback(
    (id: string) => {
      // No hacer nada si es un cluster (empieza con "cluster-")
      if (id.startsWith('cluster-')) {
        return;
      }
      onMarkerClick(id);
    },
    [onMarkerClick]
  );

  // ✅ Handler para sembrar bounds iniciales cuando el mapa está listo
  const handleMapReady = useCallback((map: google.maps.Map) => {
    const bounds = map.getBounds();
    if (!bounds) return;
    
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const mapCenter = map.getCenter();

    const initialBounds = {
      minLat: sw.lat(),
      maxLat: ne.lat(),
      minLng: sw.lng(),
      maxLng: ne.lng(),
      zoom: map.getZoom() ?? 11,
      center: {
        lat: mapCenter?.lat() ?? searchCoordinates?.lat ?? 23.6345,
        lng: mapCenter?.lng() ?? searchCoordinates?.lng ?? -102.5528,
      },
    };

    if (MAP_DEBUG) {
      console.log('[KENTRA MAP] Sembrando bounds iniciales', initialBounds);
    }

    onBoundsChanged(initialBounds);
  }, [onBoundsChanged, searchCoordinates]);

  return (
    <div className="relative w-full" style={{ height }}>
      <BasicGoogleMap
        center={mapCenter}
        markers={mapMarkers as any}
        enableClustering={true}
        onReady={handleMapReady}
        onBoundsChanged={handleBoundsChange}
        onMarkerClick={handleMarkerClickInternal}
        disableAutoFit={true}
        onMapError={handleMapError}
      />

      {/* 🔍 Debug overlay - controlled by window.__KENTRA_MAP_DEBUG__ */}
      {MAP_DEBUG && (
        <div className="pointer-events-none absolute left-2 top-2 z-20">
          <div className="pointer-events-auto max-w-xs rounded-md bg-black/80 px-3 py-2 text-[11px] text-white space-y-1">
            <div className="font-semibold">MAP DEBUG</div>
            <div>propsViewport: {properties.length}</div>
            <div>clustersViewport: {clusters.length}</div>
            <div>isLoading: {isLoading ? 'true' : 'false'}</div>
            <div>MIN_ZOOM_FOR_TILES: {MIN_ZOOM_FOR_TILES}</div>
            <div>MAX_PROPERTIES_PER_TILE: {MAX_PROPERTIES_PER_TILE}</div>
            {debugViewportBounds && (
              <>
                <div>zoom: {debugViewportBounds.zoom.toFixed(2)}</div>
                <div>
                  bounds: {debugViewportBounds.minLat.toFixed(3)},
                  {debugViewportBounds.minLng.toFixed(3)} →{' '}
                  {debugViewportBounds.maxLat.toFixed(3)},
                  {debugViewportBounds.maxLng.toFixed(3)}
                </div>
              </>
            )}
            {typeof debugViewportReason !== 'undefined' && (
              <div>
                reason:{' '}
                {debugViewportReason && debugViewportReason.length > 0
                  ? debugViewportReason
                  : 'N/A'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🔄 Overlay de carga */}
      {isLoading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/20 backdrop-blur-[2px]">
          <div className="rounded-lg bg-background/95 px-4 py-3 shadow-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Cargando propiedades en el mapa...</span>
            </div>
          </div>
        </div>
      )}

      {/* ❌ Overlay de error crítico (solo para fallos de Google Maps) */}
      {mapError && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/30 backdrop-blur-sm">
          <div className="pointer-events-auto rounded-lg bg-background border border-destructive/20 px-6 py-4 shadow-xl max-w-sm">
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <div>
                <p className="font-medium text-foreground">No pudimos cargar el mapa</p>
                <p className="text-sm text-muted-foreground mt-1">Puedes seguir usando la lista de propiedades sin problema.</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setMapError(null);
                  window.location.reload();
                }}
                className="mt-2"
              >
                Reintentar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
