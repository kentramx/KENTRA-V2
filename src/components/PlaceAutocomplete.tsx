/// <reference types="google.maps" />
import React, { useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { MapPin, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { loadGoogleMaps } from '@/lib/loadGoogleMaps';
import { placesCache } from '@/lib/placesCache';
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
  const inputRef = useRef<HTMLInputElement>(null);
  const webComponentContainerRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<any>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [useWebComponent, setUseWebComponent] = React.useState<boolean | null>(null);

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
    if (!isLoaded) return;

    const initAutocomplete = async () => {
      // Función auxiliar para manejar la selección de lugar
      const handlePlaceSelection = (location: {
        address: string;
        municipality: string;
        state: string;
        lat?: number;
        lng?: number;
      }, inputValue: string) => {
        // Guardar en caché
        if (inputValue) {
          placesCache.set(inputValue, location);
        }

        if (!location.municipality || !location.state) {
          toast({
            title: 'ℹ️ Información incompleta',
            description: 'No se pudo extraer municipio/estado. Verifica la dirección.',
          });
        }

        onPlaceSelectRef.current?.(location);
        toast({ 
          title: '📍 Ubicación seleccionada', 
          description: `${location.municipality}, ${location.state}` 
        });
      };

      try {
        // 🆕 Intentar usar el nuevo Web Component oficial
        const { PlaceAutocompleteElement } = await google.maps.importLibrary("places") as any;
        
        if (!webComponentContainerRef.current) {
          // Si no hay contenedor, usar legacy
          throw new Error('No container for web component');
        }

        const placeAutocomplete = new PlaceAutocompleteElement({
          componentRestrictions: { country: 'mx' },
          requestedLanguage: 'es',
          requestedRegion: 'MX',
        });
        
        // Aplicar estilos personalizados
        placeAutocomplete.className = showIcon 
          ? 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pl-9'
          : 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
        
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
          
          handlePlaceSelection(location, placeAutocomplete.value);
        });
        
        // Listener para detectar cuando el usuario escribe (con debouncing)
        if (onInputChange) {
          const debouncedInputHandler = () => {
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
            }
            debounceTimerRef.current = setTimeout(() => {
              onInputChange();
            }, 300);
          };
          placeAutocomplete.addEventListener('input', debouncedInputHandler);
        }

        // Si el Web Component falla, usar fallback
        placeAutocomplete.addEventListener('gmp-error', () => {
          console.warn('PlaceAutocompleteElement error, usando fallback legacy');
          setUseWebComponent(false);
        });
        
        // Agregar Web Component al contenedor (sin reemplazar nada)
        webComponentContainerRef.current.appendChild(placeAutocomplete);
        autocompleteRef.current = placeAutocomplete;
        setUseWebComponent(true);
        
      } catch (error) {
        // ⚙️ FALLBACK al método legacy si el nuevo API falla
        console.warn('PlaceAutocompleteElement no disponible, usando fallback legacy:', error);
        setUseWebComponent(false);
      }
    };

    initAutocomplete();

    return () => {
      // Limpiar debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
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
  }, [isLoaded, placeholder, defaultValue, showIcon, onInputChange]);

  // Effect separado para aplicar legacy autocomplete cuando useWebComponent es false
  useEffect(() => {
    if (!isLoaded || useWebComponent !== false || !inputRef.current) return;

    // Función auxiliar para manejar la selección de lugar
    const handlePlaceSelection = (location: {
      address: string;
      municipality: string;
      state: string;
      lat?: number;
      lng?: number;
    }, inputValue: string) => {
      // Guardar en caché
      if (inputValue) {
        placesCache.set(inputValue, location);
      }

      if (!location.municipality || !location.state) {
        toast({
          title: 'ℹ️ Información incompleta',
          description: 'No se pudo extraer municipio/estado. Verifica la dirección.',
        });
      }

      onPlaceSelectRef.current?.(location);
      toast({ 
        title: '📍 Ubicación seleccionada', 
        description: `${location.municipality}, ${location.state}` 
      });
    };

    if (onInputChange) {
      const debouncedInputHandler = () => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
          onInputChange();
        }, 300);
      };
      inputRef.current.addEventListener('input', debouncedInputHandler);
    }

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
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

      handlePlaceSelection(location, inputRef.current?.value || '');
    });

    autocompleteRef.current = autocomplete;

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, [isLoaded, useWebComponent, onInputChange]);

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
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
    );
  }

  return (
    <div className={label ? "space-y-2" : ""}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <div className="relative">
        {showIcon && <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />}
        
        {/* Contenedor para Web Component cuando esté disponible */}
        {useWebComponent === true && (
          <div ref={webComponentContainerRef} />
        )}
        
        {/* Input normal para legacy autocomplete o mientras se carga */}
        {useWebComponent !== true && (
          <input
            ref={inputRef}
            id={id}
            type="text"
            placeholder={placeholder}
            defaultValue={defaultValue}
            className={showIcon 
              ? 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pl-9'
              : 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
            }
          />
        )}
      </div>
    </div>
  );
};
