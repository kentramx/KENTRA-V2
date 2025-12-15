/// <reference types="google.maps" />
import React, { useEffect, useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { MapPin, AlertCircle, Navigation, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useJsApiLoader } from '@react-google-maps/api';
import { GOOGLE_MAPS_CONFIG, GOOGLE_MAPS_LIBRARIES } from '@/config/googleMaps';
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
  
  // Priority 2: Try route as fallback (street can indicate neighborhood in Mexico)
  for (const component of addressComponents) {
    if (component.types.includes('route')) {
      // Only use route if it looks like a neighborhood name (not a street number)
      const routeName = component.long_name || component.longText;
      if (routeName && !/^\d+/.test(routeName)) {
        colonia = routeName;
        break;
      }
    }
  }
  
  // Priority 3: Extract from formatted address if still empty
  if (!colonia && formattedAddress) {
    // Try to find neighborhood pattern in Mexican addresses
    // Format usually: "Street, Colonia Name, City, State, Country"
    const parts = formattedAddress.split(',').map(p => p.trim());
    if (parts.length >= 3) {
      // The second or third part is often the colonia
      const potentialColonia = parts[1];
      // Exclude if it looks like a postal code or city name
      if (potentialColonia && 
          !/^\d{5}/.test(potentialColonia) && 
          potentialColonia.length > 2) {
        colonia = potentialColonia;
      }
    }
  }
  
  return colonia;
};

const PlaceAutocomplete = ({
  onPlaceSelect,
  onInputChange,
  defaultValue = '',
  placeholder = 'Buscar ciudad, colonia o dirección...',
  label,
  showIcon = true,
  id = 'place-autocomplete',
  unstyled = false,
  showMyLocationButton = false,
}: PlaceAutocompleteProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [inputValue, setInputValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Usar el loader de @react-google-maps/api
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_CONFIG.apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  useEffect(() => {
    if (loadError) {
      console.error('[PlaceAutocomplete] Error cargando Google Maps API:', loadError);
      setError('No se pudo cargar Google Maps. Verifica tu conexión.');
    }
  }, [loadError]);

  // Inicializar autocomplete cuando API esté lista
  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) return;

    try {
      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'mx' },
        fields: ['address_components', 'geometry', 'formatted_address', 'name'],
        types: ['geocode'],
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place.geometry?.location) {
          console.warn('[PlaceAutocomplete] Lugar sin geometría');
          return;
        }

        const addressComponents = place.address_components || [];
        
        // 🔍 DEBUG: Mostrar TODOS los componentes crudos de Google Places
        console.log('========== GOOGLE PLACES DEBUG ==========');
        console.log('Formatted address:', place.formatted_address);
        console.log('Place name:', place.name);
        console.log('Total components:', addressComponents.length);
        console.log('Address components:');
        addressComponents.forEach((component, index) => {
          console.log(`  [${index}] ${component.long_name} (${component.short_name})`);
          console.log(`      Types: ${component.types.join(', ')}`);
        });
        console.log('==========================================');
        
        // Recolectar TODOS los valores primero (sin asignar aún)
        let adminLevel1 = '';      // Estado
        let adminLevel2 = '';      // Municipio/Delegación
        let locality = '';         // Ciudad
        let sublocalityLevel1 = ''; // Colonia (prioridad 1)
        let sublocality = '';       // Colonia (prioridad 2)
        let neighborhood = '';      // Colonia (prioridad 3)

        for (const component of addressComponents) {
          const types = component.types;
          
          if (types.includes('administrative_area_level_1')) {
            adminLevel1 = component.long_name;
          }
          if (types.includes('administrative_area_level_2')) {
            adminLevel2 = component.long_name;
          }
          if (types.includes('locality')) {
            locality = component.long_name;
          }
          if (types.includes('sublocality_level_1')) {
            sublocalityLevel1 = component.long_name;
          }
          if (types.includes('sublocality')) {
            sublocality = component.long_name;
          }
          if (types.includes('neighborhood')) {
            neighborhood = component.long_name;
          }
        }

        // DESPUÉS del loop: Asignar con prioridad correcta
        const state = adminLevel1;
        
        // Municipio: administrative_area_level_2 > locality
        const municipality = adminLevel2 || locality || '';
        
        // Colonia: sublocality_level_1 > sublocality > neighborhood > fallback
        let colonia = sublocalityLevel1 || sublocality || neighborhood || '';
        
        // Fallback: extraer colonia del formatted_address si no se encontró
        if (!colonia) {
          colonia = extractColoniaFromComponents(addressComponents, place.formatted_address);
        }
        
        // Evitar duplicar municipio en colonia
        if (colonia && colonia === municipality) {
          colonia = '';
        }

        const location = {
          address: place.formatted_address || place.name || '',
          municipality: municipality,
          state: state,
          colonia: colonia || undefined,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };

        // Debug log para verificar el parseo
        console.log('[PlaceAutocomplete] Componentes raw:', {
          adminLevel1,
          adminLevel2,
          locality,
          sublocalityLevel1,
          sublocality,
          neighborhood,
        });
        console.log('[PlaceAutocomplete] Ubicación final:', location);

        setInputValue(location.address);
        onPlaceSelect(location);
      });

      autocompleteRef.current = autocomplete;
    } catch (err) {
      console.error('[PlaceAutocomplete] Error inicializando:', err);
      setError('Error al inicializar búsqueda de ubicaciones');
    }
  }, [isLoaded, onPlaceSelect]);

  // Actualizar valor por defecto
  useEffect(() => {
    setInputValue(defaultValue);
  }, [defaultValue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    onInputChange?.(value);
  };

  const handleGetMyLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocalización no disponible",
        description: "Tu navegador no soporta geolocalización",
        variant: "destructive",
      });
      return;
    }

    setIsGettingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          
          if (!isLoaded) {
            throw new Error('Google Maps no está cargado');
          }

          const geocoder = new google.maps.Geocoder();
          const response = await geocoder.geocode({
            location: { lat: latitude, lng: longitude },
          });

          if (response.results[0]) {
            const place = response.results[0];
            const addressComponents = place.address_components || [];
            
            // Recolectar TODOS los valores primero
            let adminLevel1 = '';
            let adminLevel2 = '';
            let locality = '';
            let sublocalityLevel1 = '';
            let sublocality = '';
            let neighborhood = '';

            for (const component of addressComponents) {
              const types = component.types;
              
              if (types.includes('administrative_area_level_1')) {
                adminLevel1 = component.long_name;
              }
              if (types.includes('administrative_area_level_2')) {
                adminLevel2 = component.long_name;
              }
              if (types.includes('locality')) {
                locality = component.long_name;
              }
              if (types.includes('sublocality_level_1')) {
                sublocalityLevel1 = component.long_name;
              }
              if (types.includes('sublocality')) {
                sublocality = component.long_name;
              }
              if (types.includes('neighborhood')) {
                neighborhood = component.long_name;
              }
            }

            // Asignar con prioridad correcta
            const state = adminLevel1;
            const municipality = adminLevel2 || locality || '';
            let colonia = sublocalityLevel1 || sublocality || neighborhood || '';

            if (!colonia) {
              colonia = extractColoniaFromComponents(addressComponents, place.formatted_address);
            }

            const location = {
              address: place.formatted_address || '',
              municipality: municipality,
              state: state,
              colonia: colonia && colonia !== municipality ? colonia : undefined,
              lat: latitude,
              lng: longitude,
            };

            setInputValue(location.address);
            onPlaceSelect(location);
            
            toast({
              title: "Ubicación encontrada",
              description: location.address,
            });
          }
        } catch (err) {
          console.error('[PlaceAutocomplete] Error geocodificando:', err);
          toast({
            title: "Error",
            description: "No se pudo obtener tu dirección",
            variant: "destructive",
          });
        } finally {
          setIsGettingLocation(false);
        }
      },
      (err) => {
        console.error('[PlaceAutocomplete] Error geolocalización:', err);
        setIsGettingLocation(false);
        toast({
          title: "Error de ubicación",
          description: err.code === 1 
            ? "Permisos de ubicación denegados" 
            : "No se pudo obtener tu ubicación",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (error || loadError) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error || 'Error cargando Google Maps'}</AlertDescription>
      </Alert>
    );
  }

  const baseInputStyles = unstyled 
    ? '' 
    : 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className="w-full">
      {label && <Label htmlFor={id} className="mb-2 block">{label}</Label>}
      <div className="relative flex gap-2">
        {showIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10">
            <MapPin className="h-4 w-4" />
          </div>
        )}
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={!isLoaded}
          className={`${baseInputStyles} ${showIcon ? 'pl-10' : ''} flex-1`}
        />
        {showMyLocationButton && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleGetMyLocation}
            disabled={isGettingLocation || !isLoaded}
            title="Usar mi ubicación"
          >
            {isGettingLocation ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export { PlaceAutocomplete };
