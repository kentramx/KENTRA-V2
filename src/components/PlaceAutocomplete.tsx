/// <reference types="google.maps" />
import React, { useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { MapPin, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { loadGoogleMaps } from '@/lib/loadGoogleMaps';
import { toast } from '@/hooks/use-toast';

interface PlaceAutocompleteProps {
  onPlaceSelect: (location: {
    address: string;
    municipality: string;
    state: string;
    lat?: number;
    lng?: number;
  }) => void;
  defaultValue?: string;
  placeholder?: string;
  label?: string;
  id?: string;
}

export const PlaceAutocomplete = ({ 
  onPlaceSelect, 
  defaultValue = '', 
  placeholder = 'Escribe para buscar dirección...',
  label = 'Dirección*',
  id = 'place-autocomplete'
}: PlaceAutocompleteProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

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
    if (!isLoaded || !containerRef.current) return;

    const initAutocomplete = async () => {
      try {
        // Limpiar contenedor
        containerRef.current!.innerHTML = '';

        // Cargar la nueva librería de Places
        const placesLibrary = await google.maps.importLibrary("places") as any;

        // Crear el nuevo elemento de autocompletado
        const autocompleteElement = new placesLibrary.PlaceAutocompleteElement();
        
        // Configurar opciones
        autocompleteElement.componentRestrictions = { country: 'mx' };
        autocompleteElement.placeholder = placeholder;
        
        // Aplicar estilos para que coincida con el diseño
        autocompleteElement.className = 'w-full';
        
        containerRef.current!.appendChild(autocompleteElement);

        // Escuchar el evento de selección
        autocompleteElement.addEventListener('gmp-placeselect', async (event: any) => {
          const place = event.place;

          if (!place) {
            toast({
              title: '⚠️ Lugar incompleto',
              description: 'Por favor selecciona una dirección de la lista de sugerencias',
              variant: 'destructive',
            });
            return;
          }

          // Obtener los campos necesarios
          await place.fetchFields({
            fields: ['addressComponents', 'formattedAddress', 'location']
          });

          let municipality = '';
          let state = '';

          // Extraer municipio y estado de los componentes de dirección
          if (place.addressComponents) {
            place.addressComponents.forEach((component: any) => {
              if (component.types.includes('locality')) {
                municipality = component.longText;
              }
              if (component.types.includes('administrative_area_level_1')) {
                state = component.longText;
              }
            });
          }

          const location = {
            address: place.formattedAddress || '',
            municipality,
            state,
            lat: place.location?.lat(),
            lng: place.location?.lng(),
          };

          if (!municipality || !state) {
            toast({
              title: 'ℹ️ Información incompleta',
              description: 'No se pudo extraer municipio/estado. Verifica la dirección.',
            });
          }

          onPlaceSelect(location);
          toast({ 
            title: '📍 Ubicación seleccionada', 
            description: `${location.municipality}, ${location.state}` 
          });
        });

        autocompleteRef.current = autocompleteElement;
      } catch (error) {
        console.error('Error inicializando PlaceAutocomplete:', error);
        setLoadError('No se pudo inicializar el autocompletado');
      }
    };

    initAutocomplete();

    return () => {
      if (autocompleteRef.current && autocompleteRef.current.remove) {
        autocompleteRef.current.remove();
        autocompleteRef.current = null;
      }
    };
  }, [isLoaded, placeholder, defaultValue, onPlaceSelect]);

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
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label} {!isLoaded && '(Cargando...)'}</Label>
      <div className="relative">
        <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
        <div 
          ref={containerRef} 
          id={id}
          className="pl-9 [&_gmp-place-autocomplete]:w-full [&_gmp-place-autocomplete_input]:w-full [&_gmp-place-autocomplete_input]:h-10 [&_gmp-place-autocomplete_input]:rounded-md [&_gmp-place-autocomplete_input]:border [&_gmp-place-autocomplete_input]:border-input [&_gmp-place-autocomplete_input]:bg-background [&_gmp-place-autocomplete_input]:px-3 [&_gmp-place-autocomplete_input]:py-2 [&_gmp-place-autocomplete_input]:text-sm [&_gmp-place-autocomplete_input]:placeholder:text-muted-foreground [&_gmp-place-autocomplete_input]:focus-visible:outline-none [&_gmp-place-autocomplete_input]:focus-visible:ring-2 [&_gmp-place-autocomplete_input]:focus-visible:ring-ring"
        />
      </div>
    </div>
  );
};
