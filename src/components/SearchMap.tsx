/**
 * ✅ Componente de mapa optimizado para la página de búsqueda
 * - Viewport-based loading con debounce
 * - Clustering automático en zoom bajo
 * - Manejo de errores con monitoring
 */

import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BasicGoogleMap from '@/components/BasicGoogleMap';
import { useTiledMap, ViewportBounds, MIN_ZOOM_FOR_TILES } from '@/hooks/useTiledMap';
import { useAdaptiveDebounce } from '@/hooks/useAdaptiveDebounce';
import type { MapProperty, PropertyFilters } from '@/types/property';
import { monitoring } from '@/lib/monitoring';

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

  // ✅ Memoizar markers - Mostrar propiedades o clusters según zoom
  const mapMarkers = useMemo(() => {
    // Si hay propiedades individuales, mostrarlas
    if (properties && properties.length > 0) {
      return properties
        .filter((p) => p.lat != null && p.lng != null)
        .map((p) => ({
          id: p.id,
          lat: p.lat as number,
          lng: p.lng as number,
          title: p.title,
          price: p.price,
          currency: p.currency as 'MXN' | 'USD',
          bedrooms: p.bedrooms,
          bathrooms: p.bathrooms,
          images: p.images,
          listing_type: p.listing_type as 'venta' | 'renta',
          address: p.address,
        }));
    }

    // Si solo hay clusters (zoom bajo), convertirlos a marcadores sintéticos
    if (clusters && clusters.length > 0) {
      return clusters.map((cluster) => ({
        id: cluster.cluster_id,
        lat: cluster.lat,
        lng: cluster.lng,
        title: `${cluster.property_count} propiedades`,
        price: cluster.avg_price,
        currency: 'MXN' as const,
        bedrooms: 0,
        bathrooms: 0,
        images: [],
        listing_type: 'venta' as const,
        address: '',
      }));
    }

    return [];
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
        markers={mapMarkers}
        enableClustering={true}
        onBoundsChanged={handleBoundsChange}
        onMarkerClick={handleMarkerClickInternal}
        onMarkerHover={handleMarkerHover}
        hoveredMarkerId={hoveredPropertyId}
        hoveredPropertyCoords={hoveredPropertyCoords}
        disableAutoFit={true}
        onMapError={onMapError}
      />

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
