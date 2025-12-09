/**
 * KENTRA MAP STACK - OFICIAL
 * Mapa de búsqueda completo con clusters y marcadores
 */

import { useState, useCallback, useRef, memo } from 'react';
import { GoogleMapBase } from './GoogleMapBase';
import { PriceMarker } from './PriceMarker';
import { ClusterMarker } from './ClusterMarker';
import { useMapData } from '@/hooks/useMapData';
import { MapBounds, MapFilters, PropertyCluster } from '@/types/map';
import { Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SearchMapProps {
  filters?: MapFilters;
  selectedPropertyId?: string | null;
  hoveredPropertyId?: string | null;
  onPropertyClick?: (propertyId: string) => void;
  onPropertyHover?: (propertyId: string | null) => void;
  className?: string;
}

function SearchMapComponent({
  filters = {},
  selectedPropertyId,
  hoveredPropertyId,
  onPropertyClick,
  onPropertyHover,
  className = '',
}: SearchMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [zoom, setZoom] = useState(5);

  const { data, isLoading, isFetching } = useMapData({
    bounds,
    zoom,
    filters,
    enabled: !!bounds,
  });

  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const handleBoundsChange = useCallback((newBounds: MapBounds) => {
    setBounds(newBounds);
  }, []);

  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  const handleClusterClick = useCallback((cluster: PropertyCluster) => {
    if (mapRef.current) {
      mapRef.current.panTo({ lat: cluster.lat, lng: cluster.lng });
      mapRef.current.setZoom(cluster.expansion_zoom);
    }
  }, []);

  const handleLocateUser = useCallback(() => {
    if (navigator.geolocation && mapRef.current) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          mapRef.current?.panTo(pos);
          mapRef.current?.setZoom(14);
        },
        () => {
          console.error('Error obteniendo ubicación');
        }
      );
    }
  }, []);

  return (
    <div className={`relative ${className}`}>
      <GoogleMapBase
        className="w-full h-full"
        onMapLoad={handleMapLoad}
        onBoundsChange={handleBoundsChange}
        onZoomChange={handleZoomChange}
      >
        {/* Clusters */}
        {data?.clusters.map((cluster) => (
          <ClusterMarker
            key={cluster.id}
            cluster={cluster}
            onClick={handleClusterClick}
          />
        ))}

        {/* Property markers */}
        {data?.properties.map((property) => (
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

      {/* Loading indicator */}
      {(isLoading || isFetching) && (
        <div className="absolute top-4 left-4 bg-background rounded-lg shadow-lg px-3 py-2 flex items-center gap-2 z-10">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm font-medium">Cargando propiedades...</span>
        </div>
      )}

      {/* Property count badge */}
      {data && !isLoading && (
        <div className="absolute top-4 left-4 bg-background rounded-lg shadow-lg px-4 py-2 z-10">
          <span className="text-sm font-bold text-foreground">
            {data.total_count.toLocaleString()}
          </span>
          <span className="text-sm text-muted-foreground ml-1">
            propiedades
          </span>
          {data.is_clustered && (
            <span className="text-xs text-muted-foreground ml-2">
              (agrupadas)
            </span>
          )}
        </div>
      )}

      {/* Locate user button */}
      <Button
        variant="secondary"
        size="icon"
        className="absolute bottom-4 right-4 shadow-lg z-10"
        onClick={handleLocateUser}
        title="Mi ubicación"
      >
        <MapPin className="h-4 w-4" />
      </Button>
    </div>
  );
}

export const SearchMap = memo(SearchMapComponent);
