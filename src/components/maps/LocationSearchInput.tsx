/**
 * LocationSearchInput - Enterprise Search Component
 *
 * Búsqueda de ubicación con Google Places Autocomplete
 * - Restricción a México
 * - Debounce integrado
 * - Estados de carga y error
 * - Accesibilidad completa
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, MapPin, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface LocationResult {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
  location?: {
    lat: number;
    lng: number;
  };
  bounds?: google.maps.LatLngBounds;
  types: string[];
}

interface LocationSearchInputProps {
  onLocationSelect: (location: LocationResult) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

// Tipos de lugares válidos para real estate
const VALID_PLACE_TYPES = [
  'locality',           // Ciudades
  'sublocality',        // Colonias/barrios
  'administrative_area_level_1', // Estados
  'administrative_area_level_2', // Municipios
  'neighborhood',       // Vecindarios
  'postal_code',        // Códigos postales
];

export function LocationSearchInput({
  onLocationSelect,
  placeholder = 'Buscar ciudad, colonia o zona...',
  className,
  disabled = false,
}: LocationSearchInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Inicializar servicios de Google Places
  useEffect(() => {
    if (typeof google !== 'undefined' && google.maps?.places) {
      autocompleteServiceRef.current = new google.maps.places.AutocompleteService();

      // PlacesService necesita un elemento DOM
      const dummyDiv = document.createElement('div');
      placesServiceRef.current = new google.maps.places.PlacesService(dummyDiv);

      // Crear token de sesión para agrupar requests
      sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
    }
  }, []);

  // Limpiar debounce al desmontar
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Click fuera para cerrar dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Buscar predicciones
  const searchPredictions = useCallback((query: string) => {
    if (!autocompleteServiceRef.current || query.length < 2) {
      setPredictions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);

    autocompleteServiceRef.current.getPlacePredictions(
      {
        input: query,
        componentRestrictions: { country: 'mx' },
        types: ['(regions)'], // Solo regiones (ciudades, estados, colonias)
        sessionToken: sessionTokenRef.current || undefined,
      },
      (results, status) => {
        setIsLoading(false);

        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          // Filtrar solo lugares relevantes para real estate
          const filtered = results.filter((prediction) =>
            prediction.types.some((type) => VALID_PLACE_TYPES.includes(type))
          );
          setPredictions(filtered.slice(0, 5));
          setIsOpen(filtered.length > 0);
        } else {
          setPredictions([]);
          setIsOpen(false);
        }
      }
    );
  }, []);

  // Handler de input con debounce
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setSelectedIndex(-1);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (value.length >= 2) {
      debounceRef.current = setTimeout(() => {
        searchPredictions(value);
      }, 300);
    } else {
      setPredictions([]);
      setIsOpen(false);
    }
  }, [searchPredictions]);

  // Obtener detalles del lugar seleccionado
  const getPlaceDetails = useCallback((prediction: google.maps.places.AutocompletePrediction) => {
    if (!placesServiceRef.current) return;

    setIsLoading(true);

    placesServiceRef.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['geometry', 'name', 'types'],
        sessionToken: sessionTokenRef.current || undefined,
      },
      (place, status) => {
        setIsLoading(false);

        if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry) {
          const result: LocationResult = {
            placeId: prediction.place_id,
            description: prediction.description,
            mainText: prediction.structured_formatting.main_text,
            secondaryText: prediction.structured_formatting.secondary_text || '',
            types: place.types || [],
          };

          if (place.geometry.location) {
            result.location = {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            };
          }

          if (place.geometry.viewport) {
            result.bounds = place.geometry.viewport;
          }

          // Resetear token de sesión después de selección
          sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();

          onLocationSelect(result);
          setInputValue(prediction.structured_formatting.main_text);
          setPredictions([]);
          setIsOpen(false);
        }
      }
    );
  }, [onLocationSelect]);

  // Handler de selección
  const handleSelect = useCallback((prediction: google.maps.places.AutocompletePrediction) => {
    getPlaceDetails(prediction);
  }, [getPlaceDetails]);

  // Navegación con teclado
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen || predictions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < predictions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : predictions.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && predictions[selectedIndex]) {
          handleSelect(predictions[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  }, [isOpen, predictions, selectedIndex, handleSelect]);

  // Limpiar input
  const handleClear = useCallback(() => {
    setInputValue('');
    setPredictions([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  }, []);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />

        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => predictions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'pl-10 pr-10 h-11',
            'bg-background border-border',
            'focus:ring-2 focus:ring-primary/20',
            'transition-all duration-200'
          )}
          aria-label="Buscar ubicación"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls="location-suggestions"
          autoComplete="off"
        />

        {/* Loading / Clear button */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : inputValue ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleClear}
              aria-label="Limpiar búsqueda"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {/* Dropdown de sugerencias */}
      {isOpen && predictions.length > 0 && (
        <div
          id="location-suggestions"
          role="listbox"
          className={cn(
            'absolute z-50 w-full mt-1',
            'bg-background border border-border rounded-lg shadow-lg',
            'max-h-[300px] overflow-y-auto',
            'animate-in fade-in-0 zoom-in-95 duration-150'
          )}
        >
          {predictions.map((prediction, index) => (
            <button
              key={prediction.place_id}
              role="option"
              aria-selected={selectedIndex === index}
              onClick={() => handleSelect(prediction)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={cn(
                'w-full px-4 py-3 text-left',
                'flex items-start gap-3',
                'transition-colors duration-100',
                'focus:outline-none',
                selectedIndex === index
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              )}
            >
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">
                  {prediction.structured_formatting.main_text}
                </div>
                {prediction.structured_formatting.secondary_text && (
                  <div className="text-xs text-muted-foreground truncate">
                    {prediction.structured_formatting.secondary_text}
                  </div>
                )}
              </div>
            </button>
          ))}

          {/* Google attribution */}
          <div className="px-4 py-2 border-t border-border">
            <img
              src="https://developers.google.com/static/maps/documentation/images/powered_by_google_on_white.png"
              alt="Powered by Google"
              className="h-4 opacity-60"
            />
          </div>
        </div>
      )}
    </div>
  );
}
