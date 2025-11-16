/// <reference types="google.maps" />
import React, { useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { MapPin, AlertCircle, Navigation, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { loadGoogleMaps } from '@/lib/loadGoogleMaps';
import { toast } from '@/hooks/use-toast';

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
            let colonia = '';
            
            addressComponents?.forEach((component) => {
              if (component.types.includes('administrative_area_level_1')) {
                state = component.long_name;
              }
              if (component.types.includes('administrative_area_level_2')) {
                municipality = component.long_name;
              } else if (!municipality && component.types.includes('locality')) {
                municipality = component.long_name;
              }
              if (component.types.includes('sublocality_level_1') || 
                  component.types.includes('sublocality') ||
                  component.types.includes('neighborhood')) {
                colonia = component.long_name;
              }
            });

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
          console.error('Error getting location:', error);
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
        console.error('Geolocation error:', error);
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
    
    console.log('[PlaceAutocomplete] Inicializando modo LEGACY');
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
      let colonia = '';
      
      place.address_components.forEach((component) => {
        if (component.types.includes('administrative_area_level_1')) {
          state = component.long_name;
        }
        if (component.types.includes('administrative_area_level_2')) {
          municipality = component.long_name;
        } else if (!municipality && component.types.includes('locality')) {
          municipality = component.long_name;
        }
        if (component.types.includes('sublocality_level_1') || 
            component.types.includes('sublocality') ||
            component.types.includes('neighborhood')) {
          colonia = component.long_name;
        }
      });
      
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
        console.warn('[PlaceAutocomplete] Container not ready, usando LEGACY');
        await initLegacyAutocomplete();
        return;
      }

      console.log('[PlaceAutocomplete] Intentando inicializar Web Component');
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
        let colonia = '';

        place.addressComponents?.forEach((component: any) => {
          if (component.types.includes('administrative_area_level_1')) {
            state = component.longText;
          }
          if (component.types.includes('administrative_area_level_2')) {
            municipality = component.longText;
          } else if (!municipality && component.types.includes('locality')) {
            municipality = component.longText;
          }
          if (component.types.includes('sublocality_level_1') || 
              component.types.includes('sublocality') ||
              component.types.includes('neighborhood')) {
            colonia = component.longText;
          }
        });

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

      console.log('[PlaceAutocomplete] Web Component inicializado exitosamente');
      setUseWebComponent(true);
      
    } catch (error) {
      console.warn('[PlaceAutocomplete] Web Component falló, usando LEGACY:', error);
      await initLegacyAutocomplete();
    }
  }, [id, placeholder, showIcon, unstyled, handlePlaceSelection, initLegacyAutocomplete, onInputChange]);

  // ✅ FASE 3: Agregar logs de debugging
  useEffect(() => {
    console.log('[PlaceAutocomplete] Cargando Google Maps...');
    loadGoogleMaps()
      .then(() => {
        console.log('[PlaceAutocomplete] Google Maps cargado exitosamente');
        setIsLoaded(true);
      })
      .catch((err) => {
        console.error('[PlaceAutocomplete] Error loading Google Maps:', err);
        setLoadError(err.message);
      });
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    
    console.log('[PlaceAutocomplete] Iniciando autocomplete con delay de 100ms...');
    const initTimer = setTimeout(() => {
      initAutocomplete();
    }, 100);
    
    return () => clearTimeout(initTimer);
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
