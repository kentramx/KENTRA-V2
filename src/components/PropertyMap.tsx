/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                   KENTRA MAP STACK - COMPONENTE OFICIAL                      ║
 * ║                      Mapa de Detalle de Propiedad                            ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 * 
 * 📍 PROPÓSITO:
 * Este es el componente OFICIAL para mostrar mapas de propiedades individuales
 * en la página de detalle. Cualquier nueva funcionalidad relacionada con mapas
 * de detalle de propiedad DEBE integrarse aquí.
 * 
 * 🛠️ TECNOLOGÍA:
 * - Google Maps JavaScript API
 * - Geocoding API (para direcciones sin coordenadas)
 * - Marcador único por propiedad
 * 
 * 🎯 CARACTERÍSTICAS:
 * - Geocodificación automática de direcciones
 * - Validación robusta de coordenadas
 * - Fallback a ubicación predeterminada si no hay datos
 * - Manejo de errores con toasts informativos
 * - Street View y controles de mapa completos
 * 
 * 📦 DEPENDENCIAS OFICIALES:
 * - loadGoogleMaps (loader de API)
 * 
 * ⚠️ IMPORTANTE:
 * Este componente es parte del stack de producción estable.
 * No crear alternativas experimentales para mapas de detalle.
 */
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
        console.error('❌ [PropertyMap] Error cargando Google Maps API:', err);
        const errorMessage = err?.message || 'Error desconocido al cargar Google Maps';
        setMapError(errorMessage);
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
      // ✅ Validación robusta de coordenadas
      const isValidCoordinate = (value: any): value is number => {
        return typeof value === 'number' && !isNaN(value) && isFinite(value);
      };

      const validLat = isValidCoordinate(lat) ? lat : null;
      const validLng = isValidCoordinate(lng) ? lng : null;

      // Coordenadas de fallback (Guadalajara centro)
      const FALLBACK_LAT = 20.6597;
      const FALLBACK_LNG = -103.3496;

      const finalLat = validLat ?? FALLBACK_LAT;
      const finalLng = validLng ?? FALLBACK_LNG;
      const hasValidCoords = validLat !== null && validLng !== null;

      // Initialize map if not already done
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new google.maps.Map(mapRef.current, {
          center: { lat: finalLat, lng: finalLng },
          zoom: hasValidCoords ? 15 : 11,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
        });
      }

      // Geocode if we have address but no valid coordinates
      if (address && !hasValidCoords) {
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
      } else if (hasValidCoords) {
        // We have valid coordinates, use them directly
        const location = { lat: finalLat, lng: finalLng };
        
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
      } else {
        // ✅ Sin coordenadas válidas ni dirección: mostrar mapa de fallback sin marcador
        console.warn('[PropertyMap] Sin coordenadas válidas ni dirección para geocodificar');
        mapInstanceRef.current?.setCenter({ lat: finalLat, lng: finalLng });
        mapInstanceRef.current?.setZoom(11);
      }
    } catch (error) {
      console.error('❌ [PropertyMap] Error creando mapa:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al crear el mapa';
      setMapError(errorMessage);
      
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
