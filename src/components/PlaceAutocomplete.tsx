import React, { useState, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2, Navigation } from 'lucide-react';

/**
 * PlaceAutocomplete - Input simple de ubicación
 * 
 * Este componente es un input controlado simple para búsqueda de ubicaciones.
 */

export interface PlaceAutocompleteProps {
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

export const PlaceAutocomplete: React.FC<PlaceAutocompleteProps> = ({
  onPlaceSelect,
  onInputChange,
  defaultValue = '',
  placeholder = 'Buscar ubicación...',
  label,
  showIcon = true,
  id = 'place-autocomplete',
  unstyled = false,
  showMyLocationButton = false,
}) => {
  const [inputValue, setInputValue] = useState(defaultValue);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    onInputChange?.(value);
  }, [onInputChange]);

  const handleSubmit = useCallback(() => {
    if (!inputValue.trim()) return;
    
    // Sin geocoding por ahora - solo devolver el texto
    onPlaceSelect({
      address: inputValue.trim(),
      municipality: '',
      state: '',
      colonia: '',
      lat: undefined,
      lng: undefined,
    });
  }, [inputValue, onPlaceSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handleGetMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      console.warn('Geolocation no soportada');
      return;
    }

    setIsLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setInputValue('Mi ubicación');
        onPlaceSelect({
          address: 'Mi ubicación',
          municipality: '',
          state: '',
          colonia: '',
          lat: latitude,
          lng: longitude,
        });
        setIsLoadingLocation(false);
      },
      (error) => {
        console.error('Error obteniendo ubicación:', error);
        setIsLoadingLocation(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, [onPlaceSelect]);

  if (unstyled) {
    return (
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full"
        autoComplete="off"
      />
    );
  }

  return (
    <div className="w-full space-y-2">
      {label && (
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
      )}
      <div className="relative flex items-center gap-2">
        {showIcon && (
          <MapPin className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
        )}
        <Input
          ref={inputRef}
          id={id}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={showIcon ? 'pl-10' : ''}
          autoComplete="off"
        />
        {showMyLocationButton && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleGetMyLocation}
            disabled={isLoadingLocation}
            className="shrink-0"
            title="Usar mi ubicación"
          >
            {isLoadingLocation ? (
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

export default PlaceAutocomplete;
