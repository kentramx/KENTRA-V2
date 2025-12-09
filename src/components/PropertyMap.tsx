/**
 * Componente de mapa para detalle de propiedad
 * Usa la nueva arquitectura de Google Maps
 */
/// <reference types="google.maps" />
import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { GOOGLE_MAPS_CONFIG, GOOGLE_MAPS_LIBRARIES } from '@/config/googleMaps';
import { toast } from '@/hooks/use-toast';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface PropertyMapProps {
  address?: string;
  lat?: number;
  lng?: number;
  height?: string;
}

export const PropertyMap = ({ address, lat, lng, height = '400px' }: PropertyMapProps) => {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Cargar API de Google Maps
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_CONFIG.apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // Validar coordenadas
  const isValidCoordinate = (value: any): value is number => {
    return typeof value === 'number' && !isNaN(value) && isFinite(value);
  };

  // Geocodificar dirección si no hay coordenadas
  useEffect(() => {
    if (!isLoaded) return;

    const validLat = isValidCoordinate(lat) ? lat : null;
    const validLng = isValidCoordinate(lng) ? lng : null;

    // Si tenemos coordenadas válidas, usarlas directamente
    if (validLat && validLng) {
      setMapCenter({ lat: validLat, lng: validLng });
      return;
    }

    // Si tenemos dirección, geocodificarla
    if (address) {
      setIsGeocoding(true);
      const geocoder = new google.maps.Geocoder();
      
      geocoder.geocode({ address: `${address}, México` }, (results, status) => {
        setIsGeocoding(false);
        
        if (status === 'OK' && results?.[0]?.geometry?.location) {
          const location = results[0].geometry.location;
          setMapCenter({ lat: location.lat(), lng: location.lng() });
        } else {
          console.warn('[PropertyMap] Geocoding falló:', status);
          // Usar centro de México como fallback
          setMapCenter(GOOGLE_MAPS_CONFIG.defaultCenter);
          toast({
            title: "Ubicación aproximada",
            description: "No se pudo encontrar la ubicación exacta de la propiedad",
            variant: "default",
          });
        }
      });
    } else {
      // Sin dirección ni coordenadas
      setMapCenter(GOOGLE_MAPS_CONFIG.defaultCenter);
    }
  }, [isLoaded, lat, lng, address]);

  // Manejar error de carga
  useEffect(() => {
    if (loadError) {
      console.error('[PropertyMap] Error cargando API:', loadError);
      setMapError('No se pudo cargar Google Maps. Verifica tu conexión.');
    }
  }, [loadError]);

  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Estado de carga
  if (!isLoaded || isGeocoding) {
    return (
      <div 
        className="flex items-center justify-center bg-muted rounded-lg"
        style={{ height }}
      >
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{isGeocoding ? 'Buscando ubicación...' : 'Cargando mapa...'}</span>
        </div>
      </div>
    );
  }

  // Estado de error
  if (mapError || loadError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error al cargar el mapa</AlertTitle>
        <AlertDescription>
          {mapError || 'No se pudo cargar Google Maps'}
          <Button 
            variant="link" 
            className="p-0 h-auto ml-2"
            onClick={() => window.location.reload()}
          >
            Reintentar
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!mapCenter) {
    return (
      <div 
        className="flex items-center justify-center bg-muted rounded-lg"
        style={{ height }}
      >
        <span className="text-muted-foreground">Sin ubicación disponible</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden" style={{ height }}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={mapCenter}
        zoom={15}
        onLoad={handleMapLoad}
        options={{
          mapTypeControl: false,
          streetViewControl: true,
          fullscreenControl: true,
          zoomControl: true,
          styles: GOOGLE_MAPS_CONFIG.styles,
        }}
      >
        <Marker 
          position={mapCenter}
          animation={google.maps.Animation.DROP}
        />
      </GoogleMap>
    </div>
  );
};
