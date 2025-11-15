/// <reference types="google.maps" />
import React, { useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { loadGoogleMaps } from '@/lib/loadGoogleMaps';
import { toast } from '@/hooks/use-toast';

interface ColoniaAutocompleteProps {
  onColoniaSelect: (colonia: string) => void;
  defaultValue?: string;
  placeholder?: string;
  label?: string | React.ReactNode;
  id?: string;
  state?: string;
  municipality?: string;
}

export const ColoniaAutocomplete = ({ 
  onColoniaSelect,
  defaultValue = '', 
  placeholder = 'Escribe para buscar colonia...',
  label,
  id = 'colonia-autocomplete',
  state,
  municipality
}: ColoniaAutocompleteProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const onColoniaSelectRef = React.useRef(onColoniaSelect);
  useEffect(() => {
    onColoniaSelectRef.current = onColoniaSelect;
  }, [onColoniaSelect]);

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
    if (!isLoaded || !inputRef.current) return;

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'mx' },
      types: ['sublocality_level_1', 'sublocality', 'neighborhood'],
      fields: ['address_components', 'name'],
    });

    // Si tenemos estado/municipio, establecer bounds para filtrar resultados
    if (state && municipality) {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({
        address: `${municipality}, ${state}, México`,
        componentRestrictions: { country: 'mx' }
      }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const location = results[0].geometry.location;
          const bounds = new google.maps.LatLngBounds();
          
          // Crear bounds de ~20km alrededor del municipio
          const offset = 0.18; // Aproximadamente 20km
          bounds.extend(
            new google.maps.LatLng(
              location.lat() + offset,
              location.lng() + offset
            )
          );
          bounds.extend(
            new google.maps.LatLng(
              location.lat() - offset,
              location.lng() - offset
            )
          );
          
          autocomplete.setBounds(bounds);
          autocomplete.setOptions({ strictBounds: false });
        }
      });
    }

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();

      if (!place || !place.address_components) {
        toast({
          title: '⚠️ Selección incompleta',
          description: 'Por favor selecciona una colonia de la lista de sugerencias',
          variant: 'destructive',
        });
        return;
      }

      let colonia = '';

      // Intentar extraer nombre de colonia
      place.address_components.forEach((component) => {
        if (component.types.includes('sublocality_level_1') || 
            component.types.includes('sublocality') ||
            component.types.includes('neighborhood')) {
          colonia = component.long_name;
        }
      });

      // Si no encontramos en address_components, usar el name
      if (!colonia && place.name) {
        colonia = place.name;
      }

      if (colonia) {
        // ✅ Actualizar el valor visible del input para mantener el texto
        if (inputRef.current) {
          inputRef.current.value = colonia;
        }
        onColoniaSelectRef.current(colonia);
      } else {
        toast({
          title: '❌ Error',
          description: 'No se pudo extraer el nombre de la colonia',
          variant: 'destructive',
        });
      }
    });

    autocompleteRef.current = autocomplete;

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, [isLoaded, state, municipality]);

  if (loadError) {
    return (
      <div className="space-y-2">
        {label && (
          typeof label === 'string' ? (
            <Label htmlFor={id}>{label}</Label>
          ) : (
            <Label htmlFor={id} className="flex items-center justify-between w-full">
              {label}
            </Label>
          )
        )}
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
          placeholder={placeholder}
          defaultValue={defaultValue}
          onChange={(e) => onColoniaSelect(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          required
        />
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="space-y-2">
        {label && (
          typeof label === 'string' ? (
            <Label htmlFor={id}>{label}</Label>
          ) : (
            <Label htmlFor={id} className="flex items-center justify-between w-full">
              {label}
            </Label>
          )
        )}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando búsqueda de colonias...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {label && (
        typeof label === 'string' ? (
          <Label htmlFor={id}>{label}</Label>
        ) : (
          <Label htmlFor={id} className="flex items-center justify-between w-full">
            {label}
          </Label>
        )
      )}
      <input
        ref={inputRef}
        id={id}
        type="text"
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        required
      />
      <p className="text-xs text-muted-foreground">
        {state && municipality 
          ? `Buscando colonias cerca de ${municipality}, ${state}`
          : 'Selecciona primero estado y municipio para mejores resultados'}
      </p>
    </div>
  );
};
