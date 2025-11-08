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
  onInputChange?: () => void;
  defaultValue?: string;
  placeholder?: string;
  label?: string;
  showIcon?: boolean;
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
  onInputChange,
  defaultValue = '', 
  placeholder = 'Escribe para buscar dirección...',
  label,
  showIcon = true,
  id = 'place-autocomplete'
}: PlaceAutocompleteProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // keep latest onPlaceSelect without recreating input
  const onPlaceSelectRef = React.useRef(onPlaceSelect);
  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
  }, [onPlaceSelect]);

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

    const initAutocomplete = async () => {
      if (!containerRef.current) return;
      
      containerRef.current.innerHTML = '';

      try {
        // 🆕 Intentar usar el nuevo Web Component oficial
        const { PlaceAutocompleteElement } = await google.maps.importLibrary("places") as any;
        
        const placeAutocomplete = new PlaceAutocompleteElement({
          componentRestrictions: { country: 'mx' },
          requestedLanguage: 'es',
          requestedRegion: 'MX',
        });
        
        // Aplicar estilos personalizados
        placeAutocomplete.className = showIcon 
          ? 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pl-9'
          : 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
        
        if (placeholder) placeAutocomplete.placeholder = placeholder;
        if (defaultValue) placeAutocomplete.value = defaultValue;
        
        // Listener para cuando el usuario selecciona un lugar
        placeAutocomplete.addEventListener('gmp-placeselect', async ({ place }: any) => {
          if (!place) return;
          
          // Obtener los campos necesarios
          await place.fetchFields({
            fields: ['addressComponents', 'formattedAddress', 'location']
          });
          
          let municipality = '';
          let state = '';
          
          place.addressComponents?.forEach((component: any) => {
            if (component.types.includes('locality')) {
              municipality = component.longText;
            }
            if (component.types.includes('administrative_area_level_1')) {
              state = component.longText;
            }
          });
          
          const location = {
            address: place.formattedAddress || '',
            municipality,
            state,
            lat: place.location?.lat(),
            lng: place.location?.lng(),
          };
          
          if (!municipality || !state) {
            toast({
              title: 'ℹ️ Información incompleta',
              description: 'No se pudo extraer municipio/estado. Verifica la dirección.',
            });
          }
          
          onPlaceSelectRef.current?.(location);
          toast({ title: '📍 Ubicación seleccionada', description: `${location.municipality}, ${location.state}` });
        });
        
        // Listener para detectar cuando el usuario escribe
        if (onInputChange) {
          placeAutocomplete.addEventListener('input', onInputChange);
        }
        
        containerRef.current.appendChild(placeAutocomplete);
        autocompleteRef.current = placeAutocomplete;
        
      } catch (error) {
        // ⚙️ FALLBACK al método legacy si el nuevo API falla
        console.warn('PlaceAutocompleteElement no disponible, usando fallback legacy:', error);
        
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = placeholder;
        input.defaultValue = defaultValue;
        input.className = showIcon 
          ? 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pl-9'
          : 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

        containerRef.current.appendChild(input);

        if (onInputChange) {
          input.addEventListener('input', onInputChange);
        }

        const autocomplete = new google.maps.places.Autocomplete(input, {
          componentRestrictions: { country: 'mx' },
          fields: ['address_components', 'formatted_address', 'geometry'],
          types: ['(cities)'],
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

          onPlaceSelectRef.current?.(location);
          toast({ title: '📍 Ubicación seleccionada', description: `${location.municipality}, ${location.state}` });
        });

        autocompleteRef.current = autocomplete;
      }
    };

    initAutocomplete();

    return () => {
      if (autocompleteRef.current) {
        if (autocompleteRef.current instanceof HTMLElement) {
          // Cleanup para Web Component
          autocompleteRef.current.remove();
        } else {
          // Cleanup para legacy Autocomplete
          google.maps.event.clearInstanceListeners(autocompleteRef.current);
        }
        autocompleteRef.current = null;
      }
    };
  }, [isLoaded, placeholder, defaultValue]);

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
    <div className={label ? "space-y-2" : ""}>
      {label && <Label htmlFor={id}>{label} {!isLoaded && '(Cargando...)'}</Label>}
      <div className="relative">
        {showIcon && <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />}
        <div 
          ref={containerRef} 
          id={id}
          className={showIcon ? "pl-9" : ""}
        />
      </div>
    </div>
  );
};
