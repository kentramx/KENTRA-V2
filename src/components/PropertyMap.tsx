/// <reference types="google.maps" />
import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { AlertCircle, MapPin } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { loadGoogleMaps } from '@/lib/loadGoogleMaps';

interface PropertyMapProps {
  address?: string;
  lat?: number;
  lng?: number;
  height?: string;
}

export const PropertyMap = ({ address, lat, lng, height = '400px' }: PropertyMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [isGoogleMapsReady, setIsGoogleMapsReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    loadGoogleMaps()
      .then(() => {
        setIsGoogleMapsReady(true);
      })
      .catch((err) => {
        setMapError(err.message);
        toast({
          title: "🗺️ Error cargando mapa",
          description: "Verifica la configuración de Google Maps API. El mapa no se mostrará.",
          variant: "destructive",
        });
      });
  }, []);

  useEffect(() => {
    if (!isGoogleMapsReady || !mapRef.current) return;

    try {
      // Initialize map if not already done
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new google.maps.Map(mapRef.current, {
          center: { lat: lat || 20.6597, lng: lng || -103.3496 }, // Guadalajara default
          zoom: lat && lng ? 15 : 11,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
        });
      }

      // Geocode if we have address but no coordinates
      if (address && (!lat || !lng)) {
        const geocoder = new google.maps.Geocoder();
        
        geocoder.geocode({ address }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            const location = results[0].geometry.location;
            
            mapInstanceRef.current?.setCenter(location);
            mapInstanceRef.current?.setZoom(15);

            if (markerRef.current) {
              markerRef.current.setMap(null);
            }

            markerRef.current = new google.maps.Marker({
              position: location,
              map: mapInstanceRef.current,
              title: address,
            });

            toast({
              title: "📍 Ubicación geocodificada",
              description: "La dirección se mostró en el mapa correctamente",
            });
          } else {
            console.error('Geocoding failed:', status);
            
            let errorMsg = '';
            let solution = '';

            switch (status) {
              case 'ZERO_RESULTS':
                errorMsg = '🔍 No se encontró la dirección';
                solution = 'Verifica que la dirección sea correcta y completa';
                break;
              case 'OVER_QUERY_LIMIT':
                errorMsg = '⚠️ Límite de geocodificación excedido';
                solution = 'Espera un momento e intenta de nuevo. Considera habilitar facturación en Google Cloud';
                break;
              case 'REQUEST_DENIED':
                errorMsg = '🚫 Solicitud de geocodificación denegada';
                solution = 'Verifica que Geocoding API esté habilitada en Google Cloud Console';
                break;
              case 'INVALID_REQUEST':
                errorMsg = '❌ Dirección inválida';
                solution = 'La dirección proporcionada no es válida';
                break;
              default:
                errorMsg = '⚠️ Error de geocodificación';
                solution = `Error: ${status}`;
            }

            toast({
              title: errorMsg,
              description: solution,
              variant: "destructive",
              duration: 8000,
            });
          }
        });
      } else if (lat && lng) {
        // We have coordinates, use them directly
        const location = { lat, lng };
        
        mapInstanceRef.current?.setCenter(location);
        mapInstanceRef.current?.setZoom(15);

        if (markerRef.current) {
          markerRef.current.setMap(null);
        }

        markerRef.current = new google.maps.Marker({
          position: location,
          map: mapInstanceRef.current,
          title: address || 'Ubicación de la propiedad',
        });
      }
    } catch (error) {
      console.error('Error creating map:', error);
      setMapError('Error al crear el mapa');
      
      toast({
        title: "❌ Error creando mapa",
        description: "No se pudo crear la instancia del mapa. Revisa la consola para más detalles.",
        variant: "destructive",
      });
    }

    return () => {
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }
    };
  }, [isGoogleMapsReady, address, lat, lng]);

  if (mapError) {
    return (
      <Card className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Mapa no disponible</AlertTitle>
          <AlertDescription>
            {mapError}
          </AlertDescription>
        </Alert>
      </Card>
    );
  }

  if (!isGoogleMapsReady) {
    return (
      <Card className="p-6" style={{ height }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
            <p className="text-muted-foreground">Cargando mapa...</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div ref={mapRef} style={{ height, width: '100%' }} />
    </Card>
  );
};
