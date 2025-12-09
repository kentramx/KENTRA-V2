/**
 * KENTRA MAP STACK - OFICIAL
 * Componente base de Google Maps
 */

import { useCallback, useState, memo } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { GOOGLE_MAPS_CONFIG } from '@/config/googleMaps';
import { MapBounds } from '@/types/map';
import { Loader2, AlertCircle } from 'lucide-react';

const containerStyle = { width: '100%', height: '100%' };

const libraries: ("places" | "geometry")[] = ['places', 'geometry'];

interface GoogleMapBaseProps {
  onBoundsChange?: (bounds: MapBounds) => void;
  onZoomChange?: (zoom: number) => void;
  onMapLoad?: (map: google.maps.Map) => void;
  onMapClick?: (e: google.maps.MapMouseEvent) => void;
  children?: React.ReactNode;
  className?: string;
}

function GoogleMapBaseComponent({
  onBoundsChange,
  onZoomChange,
  onMapLoad,
  onMapClick,
  children,
  className = '',
}: GoogleMapBaseProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_CONFIG.apiKey,
    libraries,
  });

  const handleLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
    onMapLoad?.(mapInstance);

    // Obtener bounds iniciales después de que el mapa esté listo
    const bounds = mapInstance.getBounds();
    if (bounds && onBoundsChange) {
      onBoundsChange({
        north: bounds.getNorthEast().lat(),
        south: bounds.getSouthWest().lat(),
        east: bounds.getNorthEast().lng(),
        west: bounds.getSouthWest().lng(),
      });
    }
  }, [onMapLoad, onBoundsChange]);

  const handleIdle = useCallback(() => {
    if (!map) return;

    const bounds = map.getBounds();
    const zoom = map.getZoom();

    if (bounds && onBoundsChange) {
      onBoundsChange({
        north: bounds.getNorthEast().lat(),
        south: bounds.getSouthWest().lat(),
        east: bounds.getNorthEast().lng(),
        west: bounds.getSouthWest().lng(),
      });
    }

    if (zoom !== undefined && onZoomChange) {
      onZoomChange(zoom);
    }
  }, [map, onBoundsChange, onZoomChange]);

  if (loadError) {
    return (
      <div className={`flex items-center justify-center bg-muted ${className}`}>
        <div className="text-center p-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
          <p className="text-destructive font-medium">Error al cargar Google Maps</p>
          <p className="text-sm text-muted-foreground">Verifica tu conexión a internet</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`flex items-center justify-center bg-muted ${className}`}>
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Cargando mapa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={GOOGLE_MAPS_CONFIG.defaultCenter}
        zoom={GOOGLE_MAPS_CONFIG.defaultZoom}
        onLoad={handleLoad}
        onIdle={handleIdle}
        onClick={onMapClick}
        options={{
          minZoom: GOOGLE_MAPS_CONFIG.minZoom,
          maxZoom: GOOGLE_MAPS_CONFIG.maxZoom,
          restriction: GOOGLE_MAPS_CONFIG.restriction,
          styles: GOOGLE_MAPS_CONFIG.styles,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          gestureHandling: 'greedy',
        }}
      >
        {children}
      </GoogleMap>
    </div>
  );
}

export const GoogleMapBase = memo(GoogleMapBaseComponent);
