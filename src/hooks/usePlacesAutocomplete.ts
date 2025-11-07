/// <reference types="google.maps" />
import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/lib/loadGoogleMaps';

interface UsePlacesAutocompleteProps {
  onPlaceSelect: (place: google.maps.places.PlaceResult) => void;
}

export const usePlacesAutocomplete = ({ onPlaceSelect }: UsePlacesAutocompleteProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initAutocomplete = async () => {
      try {
        await loadGoogleMaps();
        
        if (!inputRef.current) return;

        // Cargar la nueva librería de Places
        const placesLibrary = await google.maps.importLibrary("places") as any;

        // Crear el nuevo elemento de autocompletado usando el constructor del web component
        const autocompleteElement = new placesLibrary.PlaceAutocompleteElement();
        
        // Configurar opciones
        autocompleteElement.componentRestrictions = { country: 'mx' };
        
        // Aplicar estilos para que se vea como un input normal
        autocompleteElement.className = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

        // Reemplazar el input con el nuevo elemento
        if (inputRef.current.parentNode) {
          inputRef.current.parentNode.replaceChild(autocompleteElement, inputRef.current);
        }

        // Escuchar el evento de selección
        autocompleteElement.addEventListener('gmp-placeselect', async (event: any) => {
          const place = event.place;
          
          if (place) {
            // Obtener los campos necesarios
            await place.fetchFields({
              fields: ['geometry', 'formattedAddress', 'addressComponents', 'displayName']
            });

            // Convertir al formato PlaceResult esperado
            const placeResult: google.maps.places.PlaceResult = {
              geometry: place.location ? { location: place.location } : undefined,
              formatted_address: place.formattedAddress,
              address_components: place.addressComponents,
              name: place.displayName,
            };

            onPlaceSelect(placeResult);
          }
        });

        autocompleteRef.current = autocompleteElement;
        setIsLoaded(true);
      } catch (err: any) {
        console.error('Error loading Google Maps PlaceAutocomplete:', err);
        setError(err.message);
      }
    };

    initAutocomplete();

    return () => {
      if (autocompleteRef.current && autocompleteRef.current.remove) {
        autocompleteRef.current.remove();
      }
    };
  }, [onPlaceSelect]);

  return { inputRef, isLoaded, error };
};
