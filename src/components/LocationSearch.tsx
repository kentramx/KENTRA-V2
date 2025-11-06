import { useEffect, useRef } from 'react';
import { GOOGLE_MAPS_API_KEY } from '@/config/maps';

interface LocationSearchProps {
  onLocationSelect: (location: { address: string; lat: number; lng: number; municipality: string; state: string }) => void;
  placeholder?: string;
  defaultValue?: string;
}

const LocationSearch = ({ onLocationSelect, placeholder = 'Buscar ubicación...', defaultValue = '' }: LocationSearchProps) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const pacRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const ensureScript = () => {
      // If Google Maps is already available, initialize immediately
      if (window.google && (google.maps as any).importLibrary) {
        initPAC();
        return;
      }
      const existing = document.querySelector('script[data-google-maps]') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', () => { initPAC(); }, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&v=weekly&loading=async&libraries=places&language=es&region=MX`;
      script.async = true;
      script.defer = true;
      script.setAttribute('data-google-maps', 'true');
      script.addEventListener('load', () => { initPAC(); }, { once: true });
      script.addEventListener('error', () => {
        console.error('Error cargando Google Maps JS. Revisa la API key y las restricciones de dominio.');
      }, { once: true });
      document.head.appendChild(script);
    };

    const initPAC = async () => {
      if (!hostRef.current || pacRef.current) return;

      // Load the Places library using the new loader to ensure availability
      try {
        const placesLib: any = await (google.maps as any).importLibrary?.('places');
        const PacCtor = placesLib?.PlaceAutocompleteElement || (google.maps as any).places?.PlaceAutocompleteElement;
        if (!PacCtor) {
          // Fallback: usar Autocomplete clásico con un <input>
          if ((google.maps as any).places && inputRef.current) {
            inputRef.current.classList.remove('hidden');
            const ac = new (google.maps as any).places.Autocomplete(inputRef.current, {
              types: ['address'],
              componentRestrictions: { country: 'mx' },
            });
            ac.addListener('place_changed', () => {
              const place = ac.getPlace();
              const placeId = place?.place_id;
              const description = place?.formatted_address || place?.name || inputRef.current?.value || '';
              const geocoder = new google.maps.Geocoder();
              const geocodeReq: google.maps.GeocoderRequest = placeId ? { placeId } : { address: description };
              geocoder.geocode(geocodeReq, (results, status) => {
                if (status !== 'OK' || !results || results.length === 0) return;
                const r = results[0];
                const lat = r.geometry?.location?.lat?.();
                const lng = r.geometry?.location?.lng?.();
                if (lat == null || lng == null) return;

                let municipality = '';
                let state = '';
                r.address_components?.forEach((c) => {
                  if (c.types.includes('locality')) municipality = c.long_name;
                  if (c.types.includes('administrative_area_level_1')) state = c.long_name;
                });

                onLocationSelect({
                  address: r.formatted_address || description,
                  lat,
                  lng,
                  municipality,
                  state,
                });
              });
            });
            // Set default value
            if (defaultValue && inputRef.current) inputRef.current.value = defaultValue;
            return;
          } else {
            console.error('Places Autocomplete no disponible. Verifica que la Places API esté habilitada y la clave tenga permisos.');
            return;
          }
        }
        const pac = new PacCtor();
        pac.placeholder = placeholder;
        pac.className = 'w-full';
        pacRef.current = pac;

        // Restrict to Mexico and addresses
        try {
          pac.componentRestrictions = { country: ['mx'] };
          pac.types = ['address'];
        } catch {}

        pac.addEventListener('gmpx-placechange', async () => {
          const val: any = pac.value;
          const placeId = val?.placeId;
          const description = val?.text || val?.description || '';

          const geocoder = new google.maps.Geocoder();
          const geocodeReq: google.maps.GeocoderRequest = placeId ? { placeId } : { address: description };
          geocoder.geocode(geocodeReq, (results, status) => {
            if (status !== 'OK' || !results || results.length === 0) return;
            const r = results[0];
            const lat = r.geometry?.location?.lat?.();
            const lng = r.geometry?.location?.lng?.();
            if (lat == null || lng == null) return;

            let municipality = '';
            let state = '';
            r.address_components?.forEach((c) => {
              if (c.types.includes('locality')) municipality = c.long_name;
              if (c.types.includes('administrative_area_level_1')) state = c.long_name;
            });

            onLocationSelect({
              address: r.formatted_address || description,
              lat,
              lng,
              municipality,
              state,
            });
          });
        });

        hostRef.current.appendChild(pac);
        // Set default value if provided
        if (defaultValue) {
          try { pac.value = defaultValue; } catch {}
        }
      } catch (e) {
        console.error('Error inicializando Autocomplete:', e);
      }
    };

    ensureScript();

    return () => {
      if (pacRef.current && hostRef.current?.contains(pacRef.current)) {
        hostRef.current.removeChild(pacRef.current);
      }
      pacRef.current = null;
    };
  }, [placeholder, defaultValue, onLocationSelect]);

  return (
    <div className="w-full">
      <div ref={hostRef} className="w-full" />
      <input ref={inputRef} placeholder={placeholder} defaultValue={defaultValue} className="w-full hidden" />
    </div>
  );
};

export default LocationSearch;
