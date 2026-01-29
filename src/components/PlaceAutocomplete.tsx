/// <reference types="google.maps" />
import React, { useEffect, useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { MapPin, AlertCircle, Navigation, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useJsApiLoader } from '@react-google-maps/api';
import { toast } from '@/hooks/use-toast';

// Google Maps config (inline to avoid dependency on deleted config file)
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
const GOOGLE_MAPS_LIBRARIES: ("places" | "geometry")[] = ["places", "geometry"];
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
  /** Custom classes for the input element */
  inputClassName?: string;
  /** Custom classes for the icon */
  iconClassName?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Required for extending JSX intrinsic elements
  namespace JSX {
    interface IntrinsicElements {
      'gmp-place-autocomplete': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

// Helper function to extract colonia with multiple fallback strategies
const extractColoniaFromComponents = (
  addressComponents: google.maps.GeocoderAddressComponent[] | { types: string[]; long_name?: string; longText?: string }[],
  formattedAddress?: string
): string => {
  let colonia = '';
  
  // Priority 1: Standard neighborhood/sublocality types
  const primaryTypes = ['sublocality_level_1', 'sublocality', 'neighborhood'];
  for (const component of addressComponents) {
    if (primaryTypes.some(type => component.types.includes(type))) {
      // Use type assertion to access either property safely
      const comp = component as { types: string[]; long_name?: string; longText?: string };
      colonia = comp.long_name || comp.longText || '';
      if (colonia) return colonia;
    }
  }
  
  // Priority 2: Try route as fallback (street can indicate neighborhood in Mexico)
  for (const component of addressComponents) {
    if (component.types.includes('route')) {
      // Only use route if it looks like a neighborhood name (not a street number)
      const comp = component as { types: string[]; long_name?: string; longText?: string };
      const routeName = comp.long_name || comp.longText || '';
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

// Normalización de nombres de Google Places → Base de datos mexicana
const STATE_NAME_MAP: Record<string, string> = {
  'Mexico City': 'Ciudad de México',
  'CDMX': 'Ciudad de México',
  'Distrito Federal': 'Ciudad de México',
  'Federal District': 'Ciudad de México',
  'State of Mexico': 'Estado de México',
  'México State': 'Estado de México',
  'Veracruz de Ignacio de la Llave': 'Veracruz',
  'Coahuila de Zaragoza': 'Coahuila',
  'Michoacán de Ocampo': 'Michoacán',
};

// Abreviaciones de estados mexicanos (Google Places a veces las devuelve)
const STATE_ABBREVIATIONS: Record<string, string> = {
  'Qro.': 'Querétaro',
  'Qro': 'Querétaro',
  'Gto.': 'Guanajuato',
  'Gto': 'Guanajuato',
  'Jal.': 'Jalisco',
  'Jal': 'Jalisco',
  'N.L.': 'Nuevo León',
  'NL': 'Nuevo León',
  'Mich.': 'Michoacán',
  'Mich': 'Michoacán',
  'Chih.': 'Chihuahua',
  'Chih': 'Chihuahua',
  'B.C.': 'Baja California',
  'BC': 'Baja California',
  'B.C.S.': 'Baja California Sur',
  'BCS': 'Baja California Sur',
  'S.L.P.': 'San Luis Potosí',
  'SLP': 'San Luis Potosí',
  'Q.Roo': 'Quintana Roo',
  'Q. Roo': 'Quintana Roo',
  'Tamps.': 'Tamaulipas',
  'Tamps': 'Tamaulipas',
  'Coah.': 'Coahuila',
  'Coah': 'Coahuila',
  'Ags.': 'Aguascalientes',
  'Ags': 'Aguascalientes',
  'Dgo.': 'Durango',
  'Dgo': 'Durango',
  'Nay.': 'Nayarit',
  'Nay': 'Nayarit',
  'Pue.': 'Puebla',
  'Pue': 'Puebla',
  'Ver.': 'Veracruz',
  'Ver': 'Veracruz',
  'Yuc.': 'Yucatán',
  'Yuc': 'Yucatán',
  'Zac.': 'Zacatecas',
  'Zac': 'Zacatecas',
  'Tab.': 'Tabasco',
  'Tab': 'Tabasco',
  'Oax.': 'Oaxaca',
  'Oax': 'Oaxaca',
  'Hgo.': 'Hidalgo',
  'Hgo': 'Hidalgo',
  'Mor.': 'Morelos',
  'Mor': 'Morelos',
  'Tlax.': 'Tlaxcala',
  'Tlax': 'Tlaxcala',
  'Camp.': 'Campeche',
  'Camp': 'Campeche',
  'Chis.': 'Chiapas',
  'Chis': 'Chiapas',
  'Col.': 'Colima',
  'Col': 'Colima',
  'Gro.': 'Guerrero',
  'Gro': 'Guerrero',
  'Sin.': 'Sinaloa',
  'Sin': 'Sinaloa',
  'Son.': 'Sonora',
  'Son': 'Sonora',
  'Edomex': 'Estado de México',
  'Edo. Méx.': 'Estado de México',
  'EdoMex': 'Estado de México',
  'Méx.': 'Estado de México',
};

// Lista de todos los estados mexicanos para validación
const MEXICAN_STATES = new Set([
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche',
  'Chiapas', 'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima',
  'Durango', 'Estado de México', 'Guanajuato', 'Guerrero', 'Hidalgo',
  'Jalisco', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca',
  'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa',
  'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas'
]);

// Las 16 alcaldías de CDMX para extracción del formatted_address
const CDMX_ALCALDIAS = new Set([
  'Álvaro Obregón', 'Azcapotzalco', 'Benito Juárez', 'Coyoacán',
  'Cuajimalpa de Morelos', 'Cuajimalpa', 'Cuauhtémoc', 'Gustavo A. Madero',
  'Iztacalco', 'Iztapalapa', 'La Magdalena Contreras', 'Magdalena Contreras',
  'Miguel Hidalgo', 'Milpa Alta', 'Tláhuac', 'Tlalpan',
  'Venustiano Carranza', 'Xochimilco'
]);

// Extraer alcaldía de CDMX del formatted_address cuando Google Places no la proporciona
const extractAlcaldiaFromAddress = (formattedAddress: string): string => {
  if (!formattedAddress) return '';
  
  const parts = formattedAddress.split(',').map(p => p.trim());
  
  for (const part of parts) {
    // Limpiar código postal si está presente (ej: "11550 Miguel Hidalgo")
    const cleaned = part.replace(/^\d{5}\s*/, '').trim();
    
    if (CDMX_ALCALDIAS.has(cleaned)) {
      return cleaned;
    }
    
    // También revisar si la parte original (sin limpiar) coincide
    if (CDMX_ALCALDIAS.has(part)) {
      return part;
    }
  }
  
  return '';
};

const normalizeStateName = (name: string): string => {
  return STATE_NAME_MAP[name] || name;
};

// Detectar si es CDMX para manejo especial de municipio
const isCDMX = (rawState: string): boolean => {
  return ['Mexico City', 'CDMX', 'Ciudad de México', 'Distrito Federal'].includes(rawState);
};

// Validar que un valor NO sea un estado (para evitar asignarlo como colonia)
const isStateName = (name: string): boolean => {
  // Verificar si es nombre completo
  const normalized = normalizeStateName(name);
  if (MEXICAN_STATES.has(normalized) || MEXICAN_STATES.has(name)) {
    return true;
  }
  // Verificar si es abreviación de estado
  if (STATE_ABBREVIATIONS[name]) {
    return true;
  }
  return false;
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
  inputClassName = '',
  iconClassName = '',
}: PlaceAutocompleteProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [inputValue, setInputValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Usar el loader de @react-google-maps/api
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
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
        types: ['geocode', 'establishment'],
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place.geometry?.location) {
          console.warn('[PlaceAutocomplete] Lugar sin geometría');
          return;
        }

        const addressComponents = place.address_components || [];
        
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
        // Normalizar estado (Google Places → DB)
        const state = normalizeStateName(adminLevel1);

        // Municipio: manejo especial para CDMX
        let municipality = '';
        if (isCDMX(adminLevel1)) {
          // En CDMX: adminLevel2 (alcaldía) > fallback a formatted_address
          municipality = adminLevel2 || extractAlcaldiaFromAddress(place.formatted_address || '');
        } else {
          // Resto de México: adminLevel2 > locality
          municipality = adminLevel2 || locality || '';
        }
        
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

        // ⚠️ VALIDACIÓN: Evitar que estados se asignen como colonia
        if (colonia && isStateName(colonia)) {
          console.warn(`[PlaceAutocomplete] Ignorando colonia "${colonia}" porque es un nombre de estado`);
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
            // Normalizar estado (Google Places → DB)
            const state = normalizeStateName(adminLevel1);

            // Municipio: manejo especial para CDMX
            let municipality = '';
            if (isCDMX(adminLevel1)) {
              // En CDMX: adminLevel2 (alcaldía) > fallback a formatted_address
              municipality = adminLevel2 || extractAlcaldiaFromAddress(place.formatted_address || '');
            } else {
              municipality = adminLevel2 || locality || '';
            }

            let colonia = sublocalityLevel1 || sublocality || neighborhood || '';

            if (!colonia) {
              colonia = extractColoniaFromComponents(addressComponents, place.formatted_address);
            }

            // Evitar que estados se asignen como colonia
            if (colonia && isStateName(colonia)) {
              colonia = '';
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
          <div className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10 ${iconClassName || 'text-muted-foreground'}`}>
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
          className={`${baseInputStyles} ${showIcon ? 'pl-10' : ''} flex-1 ${inputClassName}`}
        />
        {showMyLocationButton && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleGetMyLocation}
            disabled={isGettingLocation || !isLoaded}
            title="Usar mi ubicación"
            className="h-11 w-11"
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
