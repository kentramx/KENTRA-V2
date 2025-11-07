/// <reference types="google.maps" />
import React, { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/lib/loadGoogleMaps';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

interface InteractiveMapSearchProps {
  onLocationSelect: (location: {
    address: string;
    municipality: string;
    state: string;
    lat: number;
    lng: number;
  }) => void;
  height?: string;
  defaultCenter?: { lat: number; lng: number };
  defaultZoom?: number;
}

export const InteractiveMapSearch = ({
  onLocationSelect,
  height = '400px',
  defaultCenter = { lat: 23.6345, lng: -102.5528 }, // Centro de México
  defaultZoom = 5,
}: InteractiveMapSearchProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const initMap = async () => {
      try {
        await loadGoogleMaps();

        if (!isMounted || !mapRef.current) return;

        const map = new google.maps.Map(mapRef.current, {
          center: defaultCenter,
          zoom: defaultZoom,
          clickableIcons: false,
          gestureHandling: 'greedy',
        });

        mapInstanceRef.current = map;
        geocoderRef.current = new google.maps.Geocoder();

        // Agregar listener de clic en el mapa
        map.addListener('click', async (event: google.maps.MapMouseEvent) => {
          if (!event.latLng || !geocoderRef.current) return;

          const lat = event.latLng.lat();
          const lng = event.latLng.lng();

          // Actualizar marcador
          if (markerRef.current) {
            markerRef.current.setPosition({ lat, lng });
          } else {
            // Crear nuevo marcador estándar (sin AdvancedMarker)
            markerRef.current = new google.maps.Marker({
              map,
              position: { lat, lng },
              title: 'Ubicación seleccionada',
            });
          }

          // Geocodificar la ubicación (obtener dirección de coordenadas)
          setIsGeocodingAddress(true);
          
          try {
            const response = await geocoderRef.current.geocode({ location: { lat, lng } });

            if (response.results && response.results.length > 0) {
              const place = response.results[0];
              
              let municipality = '';
              let state = '';

              // Extraer componentes de dirección
              place.address_components?.forEach((component) => {
                if (component.types.includes('locality')) {
                  municipality = component.long_name;
                }
                if (component.types.includes('administrative_area_level_1')) {
                  state = component.long_name;
                }
              });

              const location = {
                address: place.formatted_address || '',
                municipality,
                state,
                lat,
                lng,
              };

              onLocationSelect(location);

              toast({
                title: '📍 Ubicación seleccionada',
                description: `${municipality}, ${state}`,
              });
            } else {
              toast({
                title: '⚠️ No se encontró dirección',
                description: 'No se pudo obtener la dirección de esta ubicación',
                variant: 'destructive',
              });
            }
          } catch (error) {
            console.error('Error geocoding:', error);
            toast({
              title: '❌ Error de geocodificación',
              description: 'No se pudo obtener la dirección. Intenta de nuevo.',
              variant: 'destructive',
            });
          } finally {
            setIsGeocodingAddress(false);
          }
        });

        setIsLoading(false);
      } catch (err) {
        console.error('Error loading map:', err);
        setError('No se pudo cargar el mapa');
        setIsLoading(false);
      }
    };

    initMap();

    return () => {
      isMounted = false;
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }
    };
  }, [defaultCenter, defaultZoom, onLocationSelect]);

  const handleMyLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: '❌ Geolocalización no disponible',
        description: 'Tu navegador no soporta geolocalización',
        variant: 'destructive',
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        if (mapInstanceRef.current) {
          mapInstanceRef.current.setCenter({ lat, lng });
          mapInstanceRef.current.setZoom(15);

          // Simular clic en la ubicación actual
          const clickEvent = {
            latLng: new google.maps.LatLng(lat, lng),
          } as google.maps.MapMouseEvent;

          google.maps.event.trigger(mapInstanceRef.current, 'click', clickEvent);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        toast({
          title: '❌ Error de ubicación',
          description: 'No se pudo obtener tu ubicación actual',
          variant: 'destructive',
        });
      }
    );
  };

  if (error) {
    return (
      <Alert variant="destructive" className="my-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="relative">
      <div
        ref={mapRef}
        style={{ height, width: '100%' }}
        className="rounded-lg overflow-hidden border border-border shadow-lg"
      />
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
          <div className="text-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Cargando mapa...</p>
          </div>
        </div>
      )}

      {isGeocodingAddress && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-border flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm font-medium">Obteniendo dirección...</span>
        </div>
      )}

      {!isLoading && (
        <>
          <div className="absolute top-4 right-4 space-y-2">
            <Button
              onClick={handleMyLocation}
              size="icon"
              variant="secondary"
              className="shadow-lg"
              title="Usar mi ubicación"
            >
              <MapPin className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg border border-border">
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <MapPin className="h-3 w-3" />
              Haz clic en el mapa para seleccionar ubicación
            </p>
          </div>
        </>
      )}
    </div>
  );
};
