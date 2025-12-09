/**
 * Mapa de búsqueda principal
 * Integra GoogleMapBase + marcadores + datos
 */

import { useState, useCallback, useEffect } from 'react';
import { GoogleMapBase } from './GoogleMapBase';
import { PriceMarker } from './PriceMarker';
import { ClusterMarker } from './ClusterMarker';
import { useMapData } from '@/hooks/useMapData';
import type { MapViewport, MapFilters, PropertyMarker, PropertyCluster } from '@/types/map';
import { Loader2, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SearchMapProps {
  filters?: MapFilters;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  height?: string;
  className?: string;
  selectedPropertyId?: string | null;
  hoveredPropertyId?: string | null;
  onPropertyClick?: (id: string) => void;
  onPropertyHover?: (property: PropertyMarker | null) => void;
  onViewportChange?: (viewport: MapViewport) => void;
  onTotalCountChange?: (count: number) => void;
}

export function SearchMap({
  filters = {},
  initialCenter,
  initialZoom,
  height = '100%',
  className,
  selectedPropertyId,
  hoveredPropertyId,
  onPropertyClick,
  onPropertyHover,
  onViewportChange,
  onTotalCountChange,
}: SearchMapProps) {
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  // Obtener datos del mapa
  const { data, isLoading, isFetching } = useMapData({
    viewport,
    filters,
    enabled: true,
  });

  // Notificar cambios de conteo
  useEffect(() => {
    if (data?.total_in_viewport !== undefined) {
      onTotalCountChange?.(data.total_in_viewport);
    }
  }, [data?.total_in_viewport, onTotalCountChange]);

  // Handler de viewport
  const handleViewportChange = useCallback((newViewport: MapViewport) => {
    setViewport(newViewport);
    onViewportChange?.(newViewport);
  }, [onViewportChange]);

  // Handler de mapa listo
  const handleMapReady = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  // Handler de click en cluster
  const handleClusterClick = useCallback((cluster: PropertyCluster) => {
    if (!map) return;
    
    // Hacer zoom al cluster
    map.panTo({ lat: cluster.lat, lng: cluster.lng });
    map.setZoom(cluster.expansion_zoom);
  }, [map]);

  // Extraer propiedades y clusters
  const properties = data?.properties || [];
  const clusters = data?.clusters || [];
  const totalCount = data?.total_in_viewport || 0;
  const isTruncated = data?.truncated || false;

  return (
    <div className="relative w-full" style={{ height }}>
      <GoogleMapBase
        onViewportChange={handleViewportChange}
        onMapReady={handleMapReady}
        initialCenter={initialCenter}
        initialZoom={initialZoom}
        height="100%"
        className={className}
      >
        {/* Renderizar clusters */}
        {clusters.map((cluster) => (
          <ClusterMarker
            key={cluster.id}
            cluster={cluster}
            onClick={handleClusterClick}
          />
        ))}

        {/* Renderizar propiedades individuales */}
        {properties.map((property) => (
          <PriceMarker
            key={property.id}
            property={property}
            isSelected={property.id === selectedPropertyId}
            isHovered={property.id === hoveredPropertyId}
            onClick={onPropertyClick}
            onHover={onPropertyHover}
          />
        ))}
      </GoogleMapBase>

      {/* Badge de conteo */}
      <div className="absolute top-4 left-4 z-10">
        <Badge 
          variant="secondary" 
          className="bg-background/95 backdrop-blur-sm shadow-lg px-3 py-1.5"
        >
          <MapPin className="h-3.5 w-3.5 mr-1.5" />
          <span className="font-semibold">{totalCount.toLocaleString()}</span>
          <span className="ml-1 text-muted-foreground">
            {totalCount === 1 ? 'propiedad' : 'propiedades'}
          </span>
          {isTruncated && (
            <span className="ml-1 text-amber-600">+</span>
          )}
        </Badge>
      </div>

      {/* Overlay de carga */}
      {(isLoading || isFetching) && (
        <div className="absolute top-4 right-4 z-10">
          <Badge variant="outline" className="bg-background/95 backdrop-blur-sm">
            <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
            Cargando...
          </Badge>
        </div>
      )}
    </div>
  );
}
