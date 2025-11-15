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

  // keep latest onPlaceSelect without recreating input
  const onPlaceSelectRef = React.useRef(onPlaceSelect);
  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
  }, [onPlaceSelect]);

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
              // Extraer colonia
              if (component.types.includes('sublocality_level_1') || 
                  component.types.includes('sublocality') ||
                  component.types.includes('neighborhood')) {
                colonia = component.long_name;
              }
            });
            
            const address = place.formatted_address;

            const location = {
              address,
              municipality,
              state,
              colonia,
              lat: latitude,
              lng: longitude
            };

            // Actualizar el input según el tipo
            if (autocompleteRef.current) {
              if (autocompleteRef.current instanceof HTMLElement) {
                // Web Component (tiene propiedad value pero TypeScript no la ve)
                (autocompleteRef.current as any).value = address;
              } else if (inputRef.current) {
                // Legacy input
                inputRef.current.value = address;
              }
            }

            onPlaceSelectRef.current(location);
            
            // Solo mostrar toast de éxito si se capturó todo
            if (colonia && municipality && state) {
              toast({
                title: '📍 Ubicación detectada',
                description: `${colonia}, ${municipality}`,
              });
            }
          }
        } catch (error) {
          console.error('Error geocoding:', error);
          toast({
            title: '❌ Error',
            description: 'No se pudo obtener la dirección',
            variant: 'destructive',
          });
        } finally {
          setIsGettingLocation(false);
        }
      },
      (error) => {
        setIsGettingLocation(false);
        
        let description = 'Error obteniendo ubicación';
        switch(error.code) {
          case error.PERMISSION_DENIED:
            description = 'Debes permitir el acceso a tu ubicación';
            break;
          case error.POSITION_UNAVAILABLE:
            description = 'Ubicación no disponible';
            break;
          case error.TIMEOUT:
            description = 'Tiempo de espera agotado';
            break;
        }
        
        toast({
          title: '❌ Error de geolocalización',
          description,
          variant: 'destructive',
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

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
        colonia?: string;
        lat?: number;
        lng?: number;
      }, inputValue: string) => {
        if (!location.municipality || !location.state) {
          toast({
            title: 'ℹ️ Información incompleta',
            description: 'No se pudo extraer municipio/estado. Verifica la dirección.',
          });
        }

        onPlaceSelectRef.current?.(location);
        
        // Solo mostrar toast de éxito si todo está completo
        if (location.colonia && location.municipality && location.state) {
          toast({ 
            title: '📍 Ubicación seleccionada', 
            description: `${location.colonia}, ${location.municipality}` 
          });
        }
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
        
        // NO especificar types para obtener TODOS los resultados incluyendo colonias
        // placeAutocomplete.types no se establece para máxima cobertura
        
        // Aplicar estilos personalizados y forzar ancho completo
        placeAutocomplete.style.display = 'block';
        placeAutocomplete.style.width = '100%';
        placeAutocomplete.style.maxWidth = 'none';
        placeAutocomplete.style.boxSizing = 'border-box';

        const baseClasses = unstyled
          ? 'h-12 w-full bg-transparent px-5 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50'
          : 'h-12 w-full rounded-full border-2 border-primary/60 bg-background px-5 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 ring-offset-background disabled:cursor-not-allowed disabled:opacity-50';
        placeAutocomplete.className = showIcon ? `${baseClasses} pl-12` : baseClasses;
        
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
          let colonia = '';
          
          place.addressComponents?.forEach((component: any) => {
            if (component.types.includes('administrative_area_level_1')) {
              state = component.longText;
            }
            // Priorizar administrative_area_level_2 (municipio), luego locality
            if (component.types.includes('administrative_area_level_2')) {
              municipality = component.longText;
            } else if (!municipality && component.types.includes('locality')) {
              municipality = component.longText;
            }
            // Extraer colonia
            if (component.types.includes('sublocality_level_1') || 
                component.types.includes('sublocality') ||
                component.types.includes('neighborhood')) {
              colonia = component.longText;
            }
          });
          
          const location = {
            address: place.formattedAddress || '',
            municipality,
            state,
            colonia,
            lat: place.location?.lat(),
            lng: place.location?.lng(),
          };
          
          handlePlaceSelection(location, placeAutocomplete.value);
        });
        
        // Listener para detectar cuando el usuario escribe (con debouncing)
        if (onInputChange) {
          const debouncedInputHandler = (e: Event) => {
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
            }
            debounceTimerRef.current = setTimeout(() => {
              const target = e.target as HTMLInputElement;
              onInputChange(target.value || '');
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
      colonia?: string;
      lat?: number;
      lng?: number;
    }, inputValue: string) => {
      if (!location.municipality || !location.state) {
        toast({
          title: 'ℹ️ Información incompleta',
          description: 'No se pudo extraer municipio/estado. Verifica la dirección.',
        });
      }

      onPlaceSelectRef.current?.(location);
      
      // Solo mostrar toast de éxito si todo está completo
      if (location.colonia && location.municipality && location.state) {
        toast({ 
          title: '📍 Ubicación seleccionada', 
          description: `${location.colonia}, ${location.municipality}` 
        });
      }
    };

    if (onInputChange) {
      const debouncedInputHandler = (e: Event) => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
          const target = e.target as HTMLInputElement;
          onInputChange(target.value || '');
        }, 300);
      };
      inputRef.current.addEventListener('input', debouncedInputHandler);
    }

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'mx' },
      fields: ['address_components', 'formatted_address', 'geometry'],
      // NO especificar types para obtener TODOS los resultados incluyendo colonias
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
      let colonia = '';

      place.address_components.forEach((component) => {
        if (component.types.includes('administrative_area_level_1')) {
          state = component.long_name;
        }
        // Priorizar administrative_area_level_2 (municipio), luego locality
        if (component.types.includes('administrative_area_level_2')) {
          municipality = component.long_name;
        } else if (!municipality && component.types.includes('locality')) {
          municipality = component.long_name;
        }
        // Extraer colonia
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
        {label && useWebComponent !== true && <Label htmlFor={id}>{label}</Label>}
        <div className="relative w-full">
        {showIcon && <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-10 pointer-events-none" />}
        
        {/* Contenedor para Web Component cuando esté disponible */}
        {useWebComponent === true && (
          <div ref={webComponentContainerRef} className="w-full" />
        )}
        
        {/* Input normal para legacy autocomplete o mientras se carga */}
        {useWebComponent !== true && (
          <input
            ref={inputRef}
            id={id}
            type="text"
            placeholder={placeholder}
            defaultValue={defaultValue}
              className={(() => {
                const base = unstyled
                  ? 'h-12 w-full bg-transparent px-5 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50'
                  : 'h-12 w-full rounded-full border-2 border-primary/60 bg-background px-5 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 ring-offset-background disabled:cursor-not-allowed disabled:opacity-50';
                return showIcon ? `${base} pl-12` : base;
              })()}
            />
        )}

        {/* Botón de Geolocalización */}
        {showMyLocationButton && isLoaded && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 z-10 hover:bg-primary/10"
            onClick={handleGetMyLocation}
            disabled={isGettingLocation}
            title="Usar mi ubicación"
          >
            {isGettingLocation ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <Navigation className="h-4 w-4 text-muted-foreground hover:text-primary" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
};
