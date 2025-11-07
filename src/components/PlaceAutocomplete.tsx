/// <reference types="google.maps" />
import React, { useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { MapPin, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { loadGoogleMaps } from '@/lib/loadGoogleMaps';
import { toast } from '@/hooks/use-toast';

interface PlaceAutocompleteProps {
  onPlaceSelect: (location: {
    address: string;
    municipality: string;
    state: string;
    lat?: number;
    lng?: number;
  }) => void;
  defaultValue?: string;
  placeholder?: string;
  label?: string;
  id?: string;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'gmp-place-autocomplete': any;
    }
  }
}

export const PlaceAutocomplete = ({ 
  onPlaceSelect, 
  defaultValue = '', 
  placeholder = 'Escribe para buscar dirección...',
  label = 'Dirección*',
  id = 'place-autocomplete'
}: PlaceAutocompleteProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  useEffect(() => {
    loadGoogleMaps()
      .then(() => {
        setIsLoaded(true);
      })
      .catch((err) => {
        console.error('Error loading Google Maps:', err);
        setLoadError(err.message);
      });
  }, []);

  useEffect(() => {
    if (!isLoaded || !containerRef.current) return;

    try {
      // Inicializar SIEMPRE Autocomplete (legacy) para máxima compatibilidad
      containerRef.current.innerHTML = '';

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = placeholder;
      input.defaultValue = defaultValue;
      input.className = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pl-9';

      containerRef.current.appendChild(input);

      const autocomplete = new google.maps.places.Autocomplete(input, {
        componentRestrictions: { country: 'mx' },
        fields: ['address_components', 'formatted_address', 'geometry'],
        types: ['address'],
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();

        if (!place || !place.address_components) {
          toast({
            title: '⚠️ Lugar incompleto',
            description: 'Por favor selecciona una dirección de la lista de sugerencias',
            variant: 'destructive',
          });
          return;
        }

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
            title: 'ℹ️ Información incompleta',
            description: 'No se pudo extraer municipio/estado. Verifica la dirección.',
          });
        }

        onPlaceSelect(location);
        toast({ title: '📍 Ubicación seleccionada', description: `${location.municipality}, ${location.state}` });
      });

      autocompleteRef.current = autocomplete;
    } catch (error) {
      console.error('Error inicializando Autocomplete legacy:', error);
      setLoadError('No se pudo inicializar el autocompletado');
    }

    return () => {
      if (autocompleteRef.current) {
        // @ts-ignore - puede ser instancia de Autocomplete
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, [isLoaded, placeholder, defaultValue, onPlaceSelect]);

  if (loadError) {
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>{label}</Label>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Google Maps no disponible</AlertTitle>
          <AlertDescription>
            Usa entrada manual. Error: {loadError}
          </AlertDescription>
        </Alert>
        <input
          id={id}
          type="text"
          placeholder="Calle, número, colonia, municipio, estado"
          defaultValue={defaultValue}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label} {!isLoaded && '(Cargando...)'}</Label>
      <div className="relative">
        <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
        <div 
          ref={containerRef} 
          id={id}
          className="pl-9 [&_gmp-place-autocomplete]:w-full [&_gmp-place-autocomplete]:min-h-[40px] [&_gmp-place-autocomplete_input]:w-full [&_gmp-place-autocomplete_input]:h-10 [&_gmp-place-autocomplete_input]:rounded-md [&_gmp-place-autocomplete_input]:border [&_gmp-place-autocomplete_input]:border-input [&_gmp-place-autocomplete_input]:bg-background [&_gmp-place-autocomplete_input]:px-3 [&_gmp-place-autocomplete_input]:py-2 [&_gmp-place-autocomplete_input]:text-sm [&_gmp-place-autocomplete_input]:ring-offset-background [&_gmp-place-autocomplete_input]:placeholder:text-muted-foreground [&_gmp-place-autocomplete_input]:focus-visible:outline-none [&_gmp-place-autocomplete_input]:focus-visible:ring-2 [&_gmp-place-autocomplete_input]:focus-visible:ring-ring [&_gmp-place-autocomplete_input]:focus-visible:ring-offset-2 [&_gmp-place-autocomplete_input]:disabled:cursor-not-allowed [&_gmp-place-autocomplete_input]:disabled:opacity-50"
        />
      </div>
    </div>
  );
};
