/**
 * ✅ Componente de mapa optimizado para la página de búsqueda
 * - Viewport-based loading con debounce
 * - Clustering automático en zoom bajo
 * - Manejo de errores con monitoring
 */

import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BasicGoogleMap from '@/components/BasicGoogleMap';
import { usePropertiesViewport, ViewportBounds } from '@/hooks/usePropertiesViewport';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { MapProperty, PropertyFilters } from '@/types/property';
import { monitoring } from '@/lib/monitoring';

interface SearchMapProps {
  filters: PropertyFilters;
  searchCoordinates: { lat: number; lng: number } | null;
  onMarkerClick: (id: string) => void;
  onPropertyHover?: (property: MapProperty | null) => void;
  hoveredPropertyId?: string | null;
  height?: string;
  onMapError?: (error: string) => void;
}

export const SearchMap: React.FC<SearchMapProps> = ({
  filters,
  searchCoordinates,
  onMarkerClick,
  onPropertyHover,
  hoveredPropertyId,
  height = '100%',
  onMapError,
}) => {
  const navigate = useNavigate();
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(null);
  
  // ✅ Debounce de viewport para evitar spam de requests
  const debouncedBounds = useDebouncedValue(viewportBounds, 300);

  // ✅ Fetch de propiedades con viewport + clustering
  const { data: viewportData, isLoading, error } = usePropertiesViewport(
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

  // ✅ Memoizar markers para evitar recálculo en cada render
  const mapMarkers = useMemo(
    () =>
      properties
        .filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number')
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
        })),
    [properties]
  );

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

  // ✅ Callback memoizado para marker click
  const handleMarkerClickInternal = useCallback(
    (id: string) => {
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
    <div style={{ height, width: '100%' }}>
      <BasicGoogleMap
        center={mapCenter}
        zoom={mapZoom}
        markers={mapMarkers}
        enableClustering={true}
        onBoundsChanged={handleBoundsChange}
        onMarkerClick={handleMarkerClickInternal}
        onMarkerHover={handleMarkerHover}
        hoveredMarkerId={hoveredPropertyId}
        disableAutoFit={true}
        onMapError={onMapError}
      />
    </div>
  );
};
