/// <reference types="@types/google.maps" />
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { MapPin, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface LocationSearchProps {
  onLocationSelect: (location: {
    address: string;
    municipality: string;
    state: string;
    lat?: number;
    lng?: number;
  }) => void;
  defaultValue?: string;
}

export const LocationSearch = ({ onLocationSelect, defaultValue }: LocationSearchProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isGoogleMapsReady, setIsGoogleMapsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const checkGoogleMaps = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        setIsGoogleMapsReady(true);
        return true;
      }
      return false;
    };

    const handleMapsLoaded = () => {
      if (checkGoogleMaps()) {
        toast({
          title: "✅ Google Maps cargado",
          description: "El autocompletado de direcciones está listo",
        });
      }
    };

    const handleMapsError = () => {
      const error = (window as any).googleMapsLoadError || 'Error desconocido';
      setLoadError(error);
      
      // Diagnóstico basado en errores comunes
      let diagnostico = '';
      let solucion = '';
      
      if (error.includes('RefererNotAllowedMapError') || error.includes('ApiNotActivatedMapError')) {
        diagnostico = '🔑 Problema de configuración de Google Cloud';
        solucion = '1. Ve a Google Cloud Console\n2. Habilita Maps JavaScript API y Places API\n3. En Credenciales, agrega estos dominios:\n   - http://localhost:5173/*\n   - https://*.lovableproject.com/*\n   - Tu dominio personalizado';
      } else if (error.includes('Script failed')) {
        diagnostico = '📡 No se pudo cargar el script de Google Maps';
        solucion = '1. Verifica tu conexión a internet\n2. Revisa que la API key sea válida\n3. Asegúrate de que no haya bloqueadores de contenido';
      } else if (error.includes('InvalidKey')) {
        diagnostico = '🔐 API Key inválida o faltante';
        solucion = '1. Ve a index.html\n2. Reemplaza YOUR_API_KEY_HERE con tu API key real\n3. Obtén una en: https://console.cloud.google.com/apis/credentials';
      } else {
        diagnostico = '⚠️ Error al cargar Google Maps';
        solucion = '1. Verifica la configuración en Google Cloud Console\n2. Revisa la consola del navegador para más detalles';
      }

      toast({
        title: diagnostico,
        description: solucion,
        variant: "destructive",
        duration: 10000,
      });
      
      console.error('Google Maps Error Details:', {
        error,
        timestamp: new Date().toISOString(),
        currentUrl: window.location.href,
      });
    };

    if (checkGoogleMaps()) {
      setIsGoogleMapsReady(true);
    } else {
      window.addEventListener('google-maps-loaded', handleMapsLoaded);
      window.addEventListener('google-maps-error', handleMapsError);
      
      // Check after a delay if still not loaded
      const timeoutId = setTimeout(() => {
        if (!checkGoogleMaps() && !loadError) {
          handleMapsError();
        }
      }, 5000);

      return () => {
        window.removeEventListener('google-maps-loaded', handleMapsLoaded);
        window.removeEventListener('google-maps-error', handleMapsError);
        clearTimeout(timeoutId);
      };
    }
  }, []);

  useEffect(() => {
    if (!isGoogleMapsReady || !inputRef.current) return;

    try {
      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'mx' },
        fields: ['address_components', 'formatted_address', 'geometry'],
        types: ['address'],
      });

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace();
        
        if (!place || !place.address_components) {
          toast({
            title: "⚠️ Lugar incompleto",
            description: "Por favor selecciona una dirección de la lista de sugerencias",
            variant: "destructive",
          });
          return;
        }

        // Extraer componentes de dirección
        let municipality = '';
        let state = '';
        
        place.address_components.forEach((component) => {
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
          lat: place.geometry?.location?.lat(),
          lng: place.geometry?.location?.lng(),
        };

        if (!municipality || !state) {
          toast({
            title: "ℹ️ Información incompleta",
            description: "No se pudo extraer municipio/estado. Verifica la dirección.",
          });
        }

        onLocationSelect(location);
        
        toast({
          title: "📍 Ubicación seleccionada",
          description: `${location.municipality}, ${location.state}`,
        });
      });
    } catch (error) {
      console.error('Error initializing autocomplete:', error);
      toast({
        title: "❌ Error de autocompletado",
        description: "No se pudo inicializar el autocompletado de direcciones. Usa entrada manual.",
        variant: "destructive",
      });
    }
  }, [isGoogleMapsReady, onLocationSelect]);

  if (loadError) {
    return (
      <div className="space-y-2">
        <Label htmlFor="address">Dirección*</Label>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Google Maps no disponible</AlertTitle>
          <AlertDescription>
            Usa entrada manual. Error: {loadError}
          </AlertDescription>
        </Alert>
        <Input
          id="address"
          placeholder="Calle, número, colonia, municipio, estado"
          defaultValue={defaultValue}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="address">Dirección* {!isGoogleMapsReady && '(Cargando autocompletado...)'}</Label>
      <div className="relative">
        <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          id="address"
          placeholder="Escribe para buscar dirección..."
          defaultValue={defaultValue}
          className="pl-9"
          disabled={!isGoogleMapsReady}
        />
      </div>
    </div>
  );
};
