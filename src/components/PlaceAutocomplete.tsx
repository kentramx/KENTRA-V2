/// <reference types="google.maps" />
import React, { useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { MapPin, AlertCircle, Navigation, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { loadGoogleMaps } from '@/lib/loadGoogleMaps';
import { toast } from '@/hooks/use-toast';
import { monitoring } from '@/lib/monitoring';

interface PlaceAutocompleteProps {
  onPlaceSelect: (location: {
    address: string;
    municipality: string;
    state: string;
    colonia?: string;
    lat?: number;
    lng?: number;
  }) => void;
  onInputChange?: (value: string) => void;
  defaultValue?: string;
  placeholder?: string;
  label?: string;
  showIcon?: boolean;
  id?: string;
  unstyled?: boolean;
  showMyLocationButton?: boolean;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'gmp-place-autocomplete': any;
    }
  }
}

// Helper function to extract colonia with multiple fallback strategies
const extractColoniaFromComponents = (
  addressComponents: google.maps.GeocoderAddressComponent[] | any[],
  formattedAddress?: string
): string => {
  let colonia = '';
  
  // Priority 1: Standard neighborhood/sublocality types
  const primaryTypes = ['sublocality_level_1', 'sublocality', 'neighborhood'];
  for (const component of addressComponents) {
    if (primaryTypes.some(type => component.types.includes(type))) {
      colonia = component.long_name || component.longText;
      if (colonia) return colonia;
    }
  }
  
  // Priority 2: Additional location types that might contain colonia
  const secondaryTypes = ['route', 'postal_town', 'premise', 'sublocality_level_2'];
  for (const component of addressComponents) {
    if (secondaryTypes.some(type => component.types.includes(type))) {
      const value = component.long_name || component.longText;
      // Only use if it doesn't look like a street number or too generic
      if (value && !value.match(/^\d+$/) && value.length > 3) {
        colonia = value;
        if (colonia) return colonia;
      }
    }
  }
  
  // Priority 3: Extract from formatted address (first part before comma)
  if (formattedAddress) {
    const parts = formattedAddress.split(',');
    if (parts.length > 0) {
      const firstPart = parts[0].trim();
      // Check if first part looks like a colonia name (not just numbers)
      if (firstPart && !firstPart.match(/^\d+/) && firstPart.length > 5) {
        return firstPart;
      }
    }
  }
  
  return colonia;
};

export const PlaceAutocomplete = ({ 
  onPlaceSelect,
  onInputChange,
  defaultValue = '', 
  placeholder = 'Escribe para buscar dirección...',
  label,
  showIcon = true,
  id = 'place-autocomplete',
  unstyled = false,
  showMyLocationButton = true
}: PlaceAutocompleteProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const webComponentContainerRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<any>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initRef = useRef(false);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [useWebComponent, setUseWebComponent] = React.useState<boolean | null>(null);
  const [isGettingLocation, setIsGettingLocation] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(defaultValue);

  const onPlaceSelectRef = React.useRef(onPlaceSelect);
  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
  }, [onPlaceSelect]);

  useEffect(() => {
    setInputValue(defaultValue);
  }, [defaultValue]);

  const handleGetMyLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        title: '❌ Geolocalización no disponible',
        description: 'Tu navegador no soporta geolocalización',
        variant: 'destructive',
      });
      return;
    }

    setIsGettingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          await loadGoogleMaps();

          const geocoder = new google.maps.Geocoder();
          const result = await geocoder.geocode({
            location: { lat: latitude, lng: longitude }
          });

          if (result.results[0]) {
            const place = result.results[0];
            const addressComponents = place.address_components;
            
            let municipality = '';
            let state = '';
            
            addressComponents?.forEach((component) => {
              if (component.types.includes('administrative_area_level_1')) {
                state = component.long_name;
              }
              if (component.types.includes('administrative_area_level_2')) {
                municipality = component.long_name;
              }
              // ✅ Soporte para Alcaldías de CDMX (sublocality_level_1)
              if (!municipality && component.types.includes('sublocality_level_1')) {
                municipality = component.long_name;
              }
              // Fallback a locality
              if (!municipality && component.types.includes('locality')) {
                municipality = component.long_name;
              }
            });
            
            // Use enhanced colonia extraction
            const colonia = extractColoniaFromComponents(
              addressComponents || [], 
              place.formatted_address
            );

            const location = {
              address: place.formatted_address || '',
              municipality,
              state,
              colonia,
              lat: latitude,
              lng: longitude,
            };

            setInputValue(location.address);
            onPlaceSelectRef.current(location);

            toast({
              title: '📍 Ubicación detectada',
              description: location.colonia 
                ? `${location.colonia}, ${location.municipality}` 
                : location.municipality,
            });
          }
        } catch (error) {
          monitoring.error('Error getting location from coordinates', {
            component: 'PlaceAutocomplete',
            latitude,
            longitude,
            error,
          });
          toast({
            title: '❌ Error',
            description: 'No se pudo obtener tu ubicación',
            variant: 'destructive',
          });
        } finally {
          setIsGettingLocation(false);
        }
      },
      (error) => {
        monitoring.warn('Geolocation permission denied or error', {
          component: 'PlaceAutocomplete',
          errorCode: error.code,
          errorMessage: error.message,
        });
        toast({
          title: '❌ Error de geolocalización',
          description: 'No se pudo acceder a tu ubicación',
          variant: 'destructive',
        });
        setIsGettingLocation(false);
      }
    );
  };

  // ✅ FASE 1: Mover handlePlaceSelection fuera de initAutocomplete
  const handlePlaceSelection = React.useCallback((location: {
    address: string;
    municipality: string;
    state: string;
    colonia?: string;
    lat?: number;
    lng?: number;
  }) => {
    if (!location.municipality || !location.state) {
      toast({
        title: 'ℹ️ Información incompleta',
        description: 'No se pudo extraer municipio/estado. Verifica la dirección.',
      });
    }

    setInputValue(location.address);
    onPlaceSelectRef.current?.(location);
    
    if (location.colonia && location.municipality && location.state) {
      toast({ 
        title: '📍 Ubicación seleccionada', 
        description: `${location.colonia}, ${location.municipality}` 
      });
    }
  }, []);

  // ✅ FASE 1: Definir initLegacyAutocomplete como función independiente
  const initLegacyAutocomplete = React.useCallback(async () => {
    if (!inputRef.current) return;
    
    monitoring.debug('Initializing PlaceAutocomplete in LEGACY mode', {
      component: 'PlaceAutocomplete',
    });
    setUseWebComponent(false);
    
    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'mx' },
      fields: ['address_components', 'geometry', 'name', 'formatted_address'],
    });
    
    autocompleteRef.current = autocomplete;
    
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      
      if (!place.address_components) return;
      
      let municipality = '';
      let state = '';
      let locality = ''; // Variable temporal para guardar la localidad
      
      place.address_components.forEach((component) => {
        if (component.types.includes('administrative_area_level_1')) {
          state = component.long_name;
        }
        if (component.types.includes('administrative_area_level_2')) {
          municipality = component.long_name;
        }
        // ✅ Soporte para Alcaldías de CDMX (sublocality_level_1)
        if (!municipality && component.types.includes('sublocality_level_1')) {
          municipality = component.long_name;
        }
        // Guardar locality pero NO asignarla todavía
        if (component.types.includes('locality')) {
          locality = component.long_name;
        }
      });
      
      // LÓGICA INTELIGENTE DE FALLBACK:
      // Solo usar 'locality' como municipio si NO es igual al estado.
      // Esto evita que "Ciudad de México" se duplique en estado y municipio.
      if (!municipality && locality && locality !== state) {
        municipality = locality;
      }
      
      // Use enhanced colonia extraction
      const colonia = extractColoniaFromComponents(
        place.address_components, 
        place.formatted_address
      );
      
      const location = {
        address: place.formatted_address || place.name || '',
        municipality,
        state,
        colonia,
        lat: place.geometry?.location?.lat(),
        lng: place.geometry?.location?.lng(),
      };
      
      handlePlaceSelection(location);
    });

    if (onInputChange && inputRef.current) {
      inputRef.current.addEventListener('input', (e) => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
          const target = e.target as HTMLInputElement;
          onInputChange(target.value || '');
        }, 300);
      });
    }
  }, [handlePlaceSelection, onInputChange]);

  // ✅ FASE 1: Simplificar initAutocomplete
  const initAutocomplete = React.useCallback(async () => {
    try {
      // Verificar que el contenedor existe Y está montado en el DOM
      if (!webComponentContainerRef.current || 
          !document.contains(webComponentContainerRef.current)) {
        monitoring.debug('Container not ready, falling back to LEGACY mode', {
          component: 'PlaceAutocomplete',
        });
        await initLegacyAutocomplete();
        return;
      }

      monitoring.debug('Attempting to initialize Web Component', {
        component: 'PlaceAutocomplete',
      });
      const { PlaceAutocompleteElement } = await google.maps.importLibrary("places") as any;

      const placeAutocomplete = new PlaceAutocompleteElement({
        componentRestrictions: { country: 'mx' },
        requestedLanguage: 'es',
        requestedRegion: 'MX',
      });

      placeAutocomplete.id = `${id}-web-component`;

      const styleClasses = unstyled
        ? 'h-12 w-full bg-transparent px-5 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50'
        : 'h-12 w-full rounded-full border-2 border-primary/60 bg-background px-5 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 ring-offset-background disabled:cursor-not-allowed disabled:opacity-50';

      placeAutocomplete.setAttribute('class', styleClasses);
      if (showIcon) {
        placeAutocomplete.style.paddingLeft = '3rem';
      }
      placeAutocomplete.placeholder = placeholder;

      webComponentContainerRef.current.innerHTML = '';
      webComponentContainerRef.current.appendChild(placeAutocomplete);

      placeAutocomplete.addEventListener('gmp-placeselect', async (event: any) => {
        const place = event.place;

        if (!place.addressComponents) {
          await place.fetchFields({
            fields: ['addressComponents', 'location', 'formattedAddress', 'displayName'],
          });
        }

        let municipality = '';
        let state = '';
        let locality = ''; // Variable temporal para guardar la localidad

        place.addressComponents?.forEach((component: any) => {
          if (component.types.includes('administrative_area_level_1')) {
            state = component.longText;
          }
          if (component.types.includes('administrative_area_level_2')) {
            municipality = component.longText;
          }
          // ✅ Soporte para Alcaldías de CDMX (sublocality_level_1)
          if (!municipality && component.types.includes('sublocality_level_1')) {
            municipality = component.longText;
          }
          // Guardar locality pero NO asignarla todavía
          if (component.types.includes('locality')) {
            locality = component.longText;
          }
        });
        
        // LÓGICA INTELIGENTE DE FALLBACK:
        // Solo usar 'locality' como municipio si NO es igual al estado.
        // Esto evita que "Ciudad de México" se duplique en estado y municipio.
        if (!municipality && locality && locality !== state) {
          municipality = locality;
        }
        
        // Use enhanced colonia extraction
        const colonia = extractColoniaFromComponents(
          place.addressComponents || [], 
          place.formattedAddress
        );

        const location = {
          address: place.formattedAddress || place.displayName || '',
          municipality,
          state,
          colonia,
          lat: place.location?.lat(),
          lng: place.location?.lng(),
        };

        handlePlaceSelection(location);
      });

      if (onInputChange) {
        const inputElement = placeAutocomplete.querySelector('input');
        if (inputElement) {
          inputElement.addEventListener('input', (e) => {
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
            }
            debounceTimerRef.current = setTimeout(() => {
              const target = e.target as HTMLInputElement;
              onInputChange(target.value || '');
            }, 300);
          });
        }
      }

      monitoring.debug('Web Component initialized successfully', {
        component: 'PlaceAutocomplete',
      });
      setUseWebComponent(true);
      
    } catch (error) {
      monitoring.warn('Web Component initialization failed, using LEGACY mode', {
        component: 'PlaceAutocomplete',
        error,
      });
      await initLegacyAutocomplete();
    }
  }, [id, placeholder, showIcon, unstyled, handlePlaceSelection, initLegacyAutocomplete, onInputChange]);

  // ✅ FASE 3: Agregar logs de debugging
  useEffect(() => {
    monitoring.debug('Loading Google Maps API', {
      component: 'PlaceAutocomplete',
    });
    loadGoogleMaps()
      .then(() => {
        monitoring.debug('Google Maps API loaded successfully', {
          component: 'PlaceAutocomplete',
        });
        setIsLoaded(true);
      })
      .catch((err) => {
        monitoring.error('Error loading Google Maps API', {
          component: 'PlaceAutocomplete',
          error: err,
        });
        monitoring.captureException(err, {
          component: 'PlaceAutocomplete',
          action: 'loadGoogleMaps',
        });
        setLoadError(err.message);
      });
  }, []);

  useEffect(() => {
    if (!isLoaded || initRef.current) return;
    
    initRef.current = true;
    monitoring.debug('Starting autocomplete initialization', {
      component: 'PlaceAutocomplete',
    });
    const initTimer = setTimeout(() => {
      initAutocomplete();
    }, 100);
    
    return () => {
      clearTimeout(initTimer);
      initRef.current = false;
    };
  }, [isLoaded, unstyled, initAutocomplete]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          No se pudo cargar Google Maps: {loadError}
        </AlertDescription>
      </Alert>
    );
  }

  // ✅ FASE 2: Mejorar renderizado del DOM
  return (
    <div className="w-full space-y-2">
      {label && (
        <Label htmlFor={id} className="text-base font-medium text-foreground">
          {label}
        </Label>
      )}
      
      <div className="relative flex items-center gap-2">
        {showIcon && (
          <div className="pointer-events-none absolute left-4 z-10 flex h-full items-center">
            <MapPin className="h-5 w-5 text-primary/70" />
          </div>
        )}

        {/* Web Component Container - solo visible cuando useWebComponent === true */}
        {useWebComponent === true && (
          <div 
            ref={webComponentContainerRef}
            className="relative flex-1"
            style={{ width: '100%' }}
          />
        )}

        {/* Legacy Input - visible cuando useWebComponent === false O cuando aún no se decide (null) */}
        {(useWebComponent === false || useWebComponent === null) && (
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              id={id}
              placeholder={placeholder}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className={
                unstyled
                  ? `h-12 w-full bg-transparent px-5 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 ${showIcon ? 'pl-12' : ''}`
                  : `h-12 w-full rounded-full border-2 border-primary/60 bg-background px-5 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${showIcon ? 'pl-12' : ''}`
              }
            />
          </div>
        )}

        {showMyLocationButton && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleGetMyLocation}
            disabled={isGettingLocation}
            className="h-12 w-12 shrink-0 rounded-full border-2 border-primary/60"
            title="Usar mi ubicación actual"
          >
            {isGettingLocation ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <Navigation className="h-5 w-5 text-primary" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
};
