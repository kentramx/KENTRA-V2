/**
 * Componente base de Google Maps para Kentra
 * 
 * RESPONSABILIDADES:
 * - Cargar API de Google Maps
 * - Renderizar mapa con configuración estándar
 * - Emitir eventos de viewport change
 * - Manejar estados de carga y error
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { GOOGLE_MAPS_CONFIG, GOOGLE_MAPS_LIBRARIES } from '@/config/googleMaps';
import type { MapViewport } from '@/types/map';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GoogleMapBaseProps {
  onViewportChange?: (viewport: MapViewport) => void;
  onMapReady?: (map: google.maps.Map) => void;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  height?: string;
  className?: string;
  children?: React.ReactNode;
}

export function GoogleMapBase({
  onViewportChange,
  onMapReady,
  initialCenter = GOOGLE_MAPS_CONFIG.defaultCenter,
  initialZoom = GOOGLE_MAPS_CONFIG.zoom.default,
  height = '100%',
  className,
  children,
}: GoogleMapBaseProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const hasInitialized = useRef(false);

  // Cargar API de Google Maps
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_CONFIG.apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // Manejar error de carga
  useEffect(() => {
    if (loadError) {
      console.error('[GoogleMapBase] Error cargando API:', loadError);
      setMapError('No se pudo cargar Google Maps. Verifica tu conexión.');
    }
  }, [loadError]);

  // Callback cuando el mapa está listo
  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    hasInitialized.current = true;
    onMapReady?.(map);
    
    // Emitir viewport inicial
    emitViewport(map);
  }, [onMapReady]);

  // Emitir cambio de viewport
  const emitViewport = useCallback((map: google.maps.Map) => {
    if (!onViewportChange) return;

    const bounds = map.getBounds();
    const center = map.getCenter();
    const zoom = map.getZoom();

    if (!bounds || !center || zoom === undefined) return;

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

    const viewport: MapViewport = {
      bounds: {
        north: ne.lat(),
        south: sw.lat(),
        east: ne.lng(),
        west: sw.lng(),
      },
      zoom,
      center: {
        lat: center.lat(),
        lng: center.lng(),
      },
    };

    onViewportChange(viewport);
  }, [onViewportChange]);

  // Handler para cuando el mapa deja de moverse
  const handleIdle = useCallback(() => {
    if (mapRef.current) {
      emitViewport(mapRef.current);
    }
  }, [emitViewport]);

  // Estado de carga
  if (!isLoaded) {
    return (
      <div 
        className={`flex items-center justify-center bg-muted ${className}`}
        style={{ height }}
      >
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Cargando mapa...</span>
        </div>
      </div>
    );
  }

  // Estado de error
  if (mapError || loadError) {
    return (
      <div 
        className={`flex items-center justify-center bg-muted ${className}`}
        style={{ height }}
      >
        <div className="text-center p-6 max-w-sm">
          <AlertCircle className="h-10 w-10 mx-auto mb-3 text-destructive" />
          <p className="font-medium mb-2">Error al cargar el mapa</p>
          <p className="text-sm text-muted-foreground mb-4">
            {mapError || 'No se pudo cargar Google Maps'}
          </p>
          <Button 
            variant="outline" 
            onClick={() => window.location.reload()}
          >
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  // Opciones del mapa - solo se crean cuando isLoaded es true
  const mapOptions: google.maps.MapOptions = {
    minZoom: GOOGLE_MAPS_CONFIG.zoom.min,
    maxZoom: GOOGLE_MAPS_CONFIG.zoom.max,
    restriction: {
      latLngBounds: GOOGLE_MAPS_CONFIG.bounds,
      strictBounds: false,
    },
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    zoomControl: true,
    zoomControlOptions: {
      position: window.google?.maps?.ControlPosition?.RIGHT_TOP ?? 3,
    },
    styles: GOOGLE_MAPS_CONFIG.styles as google.maps.MapTypeStyle[],
  };

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height }}
      mapContainerClassName={className}
      center={hasInitialized.current ? undefined : initialCenter}
      zoom={hasInitialized.current ? undefined : initialZoom}
      onLoad={handleMapLoad}
      onIdle={handleIdle}
      options={mapOptions}
    >
      {children}
    </GoogleMap>
  );
}
