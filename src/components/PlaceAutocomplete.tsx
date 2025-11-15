/// <reference types="google.maps" />
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, AlertCircle, Navigation, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { loadGoogleMaps } from '@/lib/loadGoogleMaps';

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
  className?: string;
}

export const PlaceAutocomplete = ({
  onPlaceSelect,
  onInputChange,
  placeholder = "Buscar ubicación...",
  defaultValue = "",
  showIcon = false,
  showMyLocationButton = false,
  unstyled = false,
  className = "",
  label,
  id,
}: PlaceAutocompleteProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Keep latest onPlaceSelect without recreating listeners
  const onPlaceSelectRef = useRef(onPlaceSelect);
  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
  }, [onPlaceSelect]);

  // Handle place selection with toast notification
  const handlePlaceSelection = useCallback((location: any, displayText: string) => {
    onPlaceSelectRef.current(location);
    toast.success('📍 Ubicación seleccionada', {
      description: displayText,
    });
  }, []);

  // Get user's current location
  const handleGetMyLocation = async () => {
    if (!navigator.geolocation) {
      toast.error('❌ Geolocalización no disponible', {
        description: 'Tu navegador no soporta geolocalización',
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
            
            const address = place.formatted_address;
            const displayText = colonia 
              ? `${colonia}, ${municipality}, ${state}` 
              : address || `${municipality}, ${state}`;

            if (inputRef.current) {
              inputRef.current.value = displayText;
            }

            const location = {
              address,
              municipality,
              state,
              colonia: colonia || undefined,
              lat: latitude,
              lng: longitude,
            };

            handlePlaceSelection(location, displayText);
          } else {
            toast.error('❌ Error', {
              description: 'No se pudo obtener la información de la ubicación',
            });
          }
        } catch (error) {
          console.error('Error obteniendo ubicación:', error);
          toast.error('❌ Error', {
            description: 'No se pudo obtener tu ubicación',
          });
        } finally {
          setIsGettingLocation(false);
        }
      },
      (error) => {
        console.error('Error de geolocalización:', error);
        setIsGettingLocation(false);
        toast.error('❌ Error', {
          description: 'No se pudo acceder a tu ubicación',
        });
      }
    );
  };

  // Load Google Maps
  useEffect(() => {
    loadGoogleMaps()
      .then(() => {
        setIsLoaded(true);
      })
      .catch((error) => {
        console.error('Error cargando Google Maps:', error);
        setLoadError(error.message || 'Error cargando Google Maps');
      });
  }, []);

  // Initialize Legacy Autocomplete
  useEffect(() => {
    if (!isLoaded || !window.google?.maps || !inputRef.current) {
      return;
    }

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'mx' },
      fields: ['address_components', 'formatted_address', 'geometry'],
    });

    // Set search bounds to Mexico
    const bounds = new google.maps.LatLngBounds(
      new google.maps.LatLng(14.5, -118.4), // Southwest
      new google.maps.LatLng(32.7, -86.7)   // Northeast
    );
    autocomplete.setBounds(bounds);

    // Input change listener (debounced)
    let debounceTimer: NodeJS.Timeout;
    const handleInput = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (onInputChange && inputRef.current) {
          onInputChange(inputRef.current.value);
        }
      }, 300);
    };
    
    const inputElement = inputRef.current;
    inputElement.addEventListener('input', handleInput);

    // Place selection listener
    const placeChangedListener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();

      if (!place || !place.address_components) {
        toast.error('❌ Error', {
          description: 'No se pudo obtener la información de la ubicación',
        });
        return;
      }

      // Extract municipality, state and colonia from address components
      let municipality = '';
      let state = '';
      let colonia = '';

      for (const component of place.address_components) {
        const types = component.types;

        // Municipality/City
        if (types.includes('locality') || types.includes('administrative_area_level_2')) {
          municipality = component.long_name;
        }

        // State
        if (types.includes('administrative_area_level_1')) {
          state = component.long_name;
        }

        // Colonia/Neighborhood
        if (types.includes('sublocality_level_1') || types.includes('neighborhood')) {
          colonia = component.long_name;
        }
      }

      // If no municipality found in locality, try sublocality
      if (!municipality) {
        for (const component of place.address_components) {
          if (component.types.includes('sublocality') || component.types.includes('sublocality_level_1')) {
            municipality = component.long_name;
            break;
          }
        }
      }

      // Last resort: use postal_town
      if (!municipality) {
        for (const component of place.address_components) {
          if (component.types.includes('postal_town')) {
            municipality = component.long_name;
            break;
          }
        }
      }

      const location = {
        address: place.formatted_address || '',
        municipality: municipality || 'Sin municipio',
        state: state || 'Sin estado',
        colonia: colonia || undefined,
        lat: place.geometry?.location?.lat(),
        lng: place.geometry?.location?.lng(),
      };

      // ✅ Update the visible value of the input
      const displayText = colonia 
        ? `${colonia}, ${municipality}, ${state}` 
        : place.formatted_address || `${municipality}, ${state}`;
      
      if (inputRef.current) {
        inputRef.current.value = displayText;
      }

      handlePlaceSelection(location, displayText);
    });

    autocompleteRef.current = autocomplete;

    // Cleanup listeners on unmount
    return () => {
      clearTimeout(debounceTimer);
      inputElement.removeEventListener('input', handleInput);
      if (placeChangedListener) {
        google.maps.event.removeListener(placeChangedListener);
      }
    };
  }, [isLoaded, onInputChange, handlePlaceSelection]);

  // Error state
  if (loadError) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error cargando Google Maps</AlertTitle>
          <AlertDescription>
            {loadError}. Verifica tu conexión a internet y recarga la página.
          </AlertDescription>
        </Alert>
        <div>
          <Label htmlFor="manual-address">Dirección (manual)</Label>
          <input
            id="manual-address"
            type="text"
            placeholder="Ingresa la dirección manualmente"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>
    );
  }

  // Loading state
  if (!isLoaded) {
    return (
      <div className="space-y-2">
        {label && <Label htmlFor={id}>{label}</Label>}
        <div className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Cargando mapa...</span>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div className="space-y-2">
      {label && <Label htmlFor={id}>{label}</Label>}
      
      <div className={`relative ${className}`}>
        {showIcon && (
          <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        )}

        <input
          ref={inputRef}
          type="text"
          id={id}
          placeholder={placeholder}
          defaultValue={defaultValue}
          className={
            unstyled
              ? 'w-full border-none bg-transparent outline-none'
              : `flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                showIcon ? 'pl-9' : ''
              }`
          }
        />

        {showMyLocationButton && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleGetMyLocation}
            disabled={isGettingLocation}
            className="absolute right-1 top-1/2 h-8 -translate-y-1/2"
          >
            {isGettingLocation ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Empieza a escribir para ver sugerencias de ubicación en México
      </p>
    </div>
  );
};
