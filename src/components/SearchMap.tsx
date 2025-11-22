/**
 * ✅ Componente de mapa optimizado para la página de búsqueda
 * - Viewport-based loading con debounce
 * - Clustering automático en zoom bajo
 * - Manejo de errores con monitoring
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BasicGoogleMap } from '@/components/BasicGoogleMap';
import { useTiledMap, ViewportBounds, MIN_ZOOM_FOR_TILES, MAX_PROPERTIES_PER_TILE } from '@/hooks/useTiledMap';
import { useAdaptiveDebounce } from '@/hooks/useAdaptiveDebounce';
import type { MapProperty, PropertyFilters, PropertySummary } from '@/types/property';
import { monitoring } from '@/lib/monitoring';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ✅ CONSTANTE DE SEGURIDAD: Si todo falla, mostramos México
const DEFAULT_CENTER = { lat: 23.6345, lng: -102.5528 };
const DEFAULT_ZOOM = 5;
const DEFAULT_BOUNDS: ViewportBounds = {
  minLat: 14.5388, maxLat: 32.7186,
  minLng: -118.4662, maxLng: -86.7104,
  zoom: 5
};

interface SearchMapProps {
  filters: PropertyFilters;
  searchCoordinates: { lat: number; lng: number } | null;
  onMarkerClick: (id: string) => void;
  onPropertyHover?: (property: MapProperty | null) => void;
  hoveredPropertyId?: string | null;
  hoveredPropertyCoords?: { lat: number; lng: number } | null;
  height?: string;
  onMapError?: (error: string) => void;
  onVisibleCountChange?: (count: number) => void;
  onBoundsChange?: (bounds: ViewportBounds) => void;
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
  onVisibleCountChange,
  onBoundsChange,
}) => {
  const navigate = useNavigate();
  
  // ✅ ESTADO HÍBRIDO: El mapa tiene su propia memoria.
  // Esto evita que el mapa "rebote" cuando React se actualiza.
  const [viewState, setViewState] = useState({
    center: searchCoordinates || DEFAULT_CENTER,
    zoom: searchCoordinates ? 12 : DEFAULT_ZOOM
  });

  // ✅ INICIALIZACIÓN ROBUSTA: Nunca dejar los bounds en null.
  // Esto asegura que useTiledMap arranque inmediatamente.
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds>(DEFAULT_BOUNDS);
  const [mapError, setMapError] = useState<string | null>(null);
  
  // ✅ Mantener datos previos para evitar parpadeos
  const previousMarkersRef = useRef<any[]>([]);
  
  // Ref para detectar cambios reales en la búsqueda (input del usuario)
  const prevSearchCoords = useRef(searchCoordinates);

  // ✅ EFECTO DE RESETEO INTELIGENTE
  // Solo forzamos al mapa a moverse si el usuario REALMENTE buscó una nueva ciudad.
  useEffect(() => {
    const coordsChanged = searchCoordinates && (
      !prevSearchCoords.current || 
      searchCoordinates.lat !== prevSearchCoords.current.lat || 
      searchCoordinates.lng !== prevSearchCoords.current.lng
    );

    if (coordsChanged) {
      console.log("📍 Nueva búsqueda detectada, moviendo mapa a:", searchCoordinates);
      setViewState({
        center: searchCoordinates!,
        zoom: 12
      });
      // ✅ Calculamos bounds aproximados para activar la carga de datos inmediatamente
      const r = 0.05;
      setViewportBounds({
        minLat: searchCoordinates!.lat - r, maxLat: searchCoordinates!.lat + r,
        minLng: searchCoordinates!.lng - r, maxLng: searchCoordinates!.lng + r,
        zoom: 12
      });
      prevSearchCoords.current = searchCoordinates;
    }
  }, [searchCoordinates]);
  
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

  // ✅ Memoizar markers con VALIDACIÓN ROBUSTA - Combinar propiedades y clusters simultáneamente
  const mapMarkers = useMemo(() => {
    // Si está cargando y no hay datos nuevos, mantener datos previos para evitar parpadeos
    if (isLoading && properties.length === 0 && clusters.length === 0 && previousMarkersRef.current.length > 0) {
      return previousMarkersRef.current;
    }

    const markers: any[] = [];

    // 1) Agregar propiedades individuales con type: 'property' y VALIDACIÓN ROBUSTA
    if (properties && properties.length > 0) {
      properties.forEach(p => {
        // ✅ Validación de coordenadas para evitar crash
        if (p.lat && p.lng && !isNaN(Number(p.lat)) && !isNaN(Number(p.lng))) {
          markers.push({
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
          });
        }
      });
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
  }, [properties.length, clusters.length, isLoading, properties, clusters]);

  // ✅ HANDLER ANTISALTO
  // Cuando el usuario mueve el mapa, actualizamos nuestro estado local
  // para que coincida con la realidad. Así, si React re-renderiza,
  // le pasará al mapa la posición DONDE YA ESTÁ, evitando el rebote.
  const handleBoundsChange = useCallback((bounds: ViewportBounds) => {
    setViewportBounds(bounds);
    onBoundsChange?.(bounds); // 🗣️ Notificar a Buscar.tsx
    // NO actualizamos 'viewState' aquí → el mapa sigue fluyendo suavemente
  }, [onBoundsChange]);

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
        center={viewState.center}
        zoom={viewState.zoom}
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

      {/* ✅ LOADING BADGE DISCRETO */}
      {isLoading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 px-4 py-2 rounded-full shadow-md flex items-center gap-2 z-10">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <span className="text-xs font-medium text-gray-600">Cargando zona...</span>
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
