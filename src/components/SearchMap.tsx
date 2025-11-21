/**
 * ✅ Componente de mapa optimizado para la página de búsqueda
 * - Viewport-based loading con debounce
 * - Clustering automático en zoom bajo
 * - Manejo de errores con monitoring
 */

import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BasicGoogleMap } from '@/components/BasicGoogleMap';
import { useTiledMap, ViewportBounds, MIN_ZOOM_FOR_TILES, MAX_PROPERTIES_PER_TILE } from '@/hooks/useTiledMap';
import { useAdaptiveDebounce } from '@/hooks/useAdaptiveDebounce';
import type { MapProperty, PropertyFilters, PropertySummary } from '@/types/property';
import { monitoring } from '@/lib/monitoring';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SearchMapProps {
  filters: PropertyFilters;
  searchCoordinates: { lat: number; lng: number } | null;
  onMarkerClick: (id: string) => void;
  onPropertyHover?: (property: MapProperty | null) => void;
  hoveredPropertyId?: string | null;
  hoveredPropertyCoords?: { lat: number; lng: number } | null;
  height?: string;
  onMapError?: (error: string) => void;
}

export const SearchMap: React.FC<SearchMapProps> = ({
  filters,
  searchCoordinates,
  onMarkerClick,
  onPropertyHover,
  hoveredPropertyId,
  hoveredPropertyCoords,
  height = '100%',
  onMapError,
}) => {
  const navigate = useNavigate();
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  
  // ✅ Debounce adaptativo de viewport según FPS del dispositivo
  const debouncedBounds = useAdaptiveDebounce(viewportBounds, 300);

  // 🚀 TILE-BASED ARCHITECTURE: fetch con escalabilidad infinita
  const { data: viewportData, isLoading, error } = useTiledMap(
    debouncedBounds,
    { ...filters, status: ['activa'] }
  );

  // ✅ Log de errores
  if (error) {
    monitoring.error('Error loading properties for map', {
      component: 'SearchMap',
      error,
      filters,
      bounds: debouncedBounds,
    });
  }

  const { properties = [], clusters = [] } = viewportData || {};
  
  // 🔴 LOG CRÍTICO: Verificar cuántos datos llegaron del backend
  console.log('🔴 COUNT CHECK:', { properties: properties.length, clusters: clusters.length });

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

  // ✅ Log de errores de tiles (NO bloqueante, se mantienen datos anteriores)
  if (error) {
    monitoring.error('[SearchMap] Error cargando tiles (no crítico)', {
      component: 'SearchMap',
      error,
      filters,
      bounds: debouncedBounds,
    });
  }

  // ✅ Memoizar markers - Combinar propiedades y clusters simultáneamente
  const mapMarkers = useMemo(() => {
    console.log('🔍 [SearchMap] Auditando datos para marcadores:', {
      propertiesLength: properties?.length || 0,
      clustersLength: clusters?.length || 0,
      propertiesSample: properties?.[0],
      clustersSample: clusters?.[0],
    });

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
      console.log('✅ [SearchMap] Agregadas propiedades:', propertyMarkers.length);
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
      console.log('✅ [SearchMap] Agregados clusters:', clusterMarkers.length);
    }

    console.log('🎯 [SearchMap] Total de marcadores combinados:', markers.length);
    return markers;
  }, [properties, clusters]);

  // ✅ Centro del mapa
  const mapCenter = useMemo(() => {
    if (searchCoordinates) {
      return searchCoordinates;
    }
    // Centro de México por defecto
    return { lat: 23.6345, lng: -102.5528 };
  }, [searchCoordinates]);

  const mapZoom = searchCoordinates ? 12 : 5;

  // ✅ Callback memoizado para bounds change
  const handleBoundsChange = useCallback((bounds: ViewportBounds) => {
    setViewportBounds(bounds);
  }, []);

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

  // ✅ Callback para hover que convierte markerId a MapProperty
  const handleMarkerHover = useCallback(
    (markerId: string | null) => {
      if (!onPropertyHover) return;
      
      if (markerId) {
        const property = properties.find((p) => p.id === markerId);
        if (property) {
          onPropertyHover(property);
        }
      } else {
        onPropertyHover(null);
      }
    },
    [properties, onPropertyHover]
  );

  return (
    <div className="relative w-full" style={{ height }}>
      <BasicGoogleMap
        center={mapCenter}
        zoom={mapZoom}
        markers={mapMarkers as any}
        enableClustering={true}
        onBoundsChanged={handleBoundsChange}
        onMarkerClick={handleMarkerClickInternal}
        onMarkerHover={handleMarkerHover}
        hoveredMarkerId={hoveredPropertyId}
        hoveredPropertyCoords={hoveredPropertyCoords}
        disableAutoFit={true}
        onMapError={handleMapError}
      />

      {/* Debug overlay eliminado para producción */}

      {/* 🔄 Overlay de carga */}
      {isLoading && viewportBounds && (
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

      {/* ℹ️ Mensaje de zoom bajo */}
      {viewportBounds && viewportBounds.zoom < MIN_ZOOM_FOR_TILES && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-background/90 px-4 py-2 text-sm text-muted-foreground shadow-lg backdrop-blur-sm">
            Acerca un poco más el mapa para ver propiedades.
          </div>
        </div>
      )}
    </div>
  );
};
