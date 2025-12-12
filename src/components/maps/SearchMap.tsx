/**
 * Mapa de búsqueda principal
 * Recibe datos externamente desde el padre (arquitectura unificada)
 * NO llama a useMapData internamente
 */

import { useState, useCallback } from 'react';
import { GoogleMapBase } from './GoogleMapBase';
import { PriceMarker } from './PriceMarker';
import { ClusterMarker } from './ClusterMarker';
import type { MapViewport, PropertyMarker, PropertyCluster } from '@/types/map';
import { Loader2, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SearchMapProps {
  // Datos externos (del padre)
  properties: PropertyMarker[];
  clusters: PropertyCluster[];
  totalCount: number;
  isLoading: boolean;
  isTruncated?: boolean;
  
  // Configuración
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  height?: string;
  className?: string;
  
  // Estados de interacción
  selectedPropertyId?: string | null;
  hoveredPropertyId?: string | null;
  
  // Callbacks
  onPropertyClick?: (id: string) => void;
  onPropertyHover?: (property: PropertyMarker | null) => void;
  onViewportChange?: (viewport: MapViewport) => void;
  onClusterClick?: (cluster: PropertyCluster) => void;
}

export function SearchMap({
  properties,
  clusters,
  totalCount,
  isLoading,
  isTruncated = false,
  initialCenter,
  initialZoom,
  height = '100%',
  className,
  selectedPropertyId,
  hoveredPropertyId,
  onPropertyClick,
  onPropertyHover,
  onViewportChange,
  onClusterClick,
}: SearchMapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);

  // Handler de viewport
  const handleViewportChange = useCallback((newViewport: MapViewport) => {
    onViewportChange?.(newViewport);
  }, [onViewportChange]);

  // Handler de mapa listo
  const handleMapReady = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  // Handler de click en cluster
  const handleClusterClick = useCallback((cluster: PropertyCluster) => {
    if (onClusterClick) {
      onClusterClick(cluster);
    } else if (map) {
      // Comportamiento por defecto: hacer zoom al cluster
      map.panTo({ lat: cluster.lat, lng: cluster.lng });
      map.setZoom(cluster.expansion_zoom);
    }
  }, [map, onClusterClick]);

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
      {isLoading && (
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
