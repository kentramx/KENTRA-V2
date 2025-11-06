import { useEffect, useRef } from 'react';

interface LocationSearchProps {
  onLocationSelect: (location: { address: string; lat: number; lng: number; municipality: string; state: string }) => void;
  placeholder?: string;
  defaultValue?: string;
}

const LocationSearch = ({ onLocationSelect, placeholder = 'Buscar ubicación...', defaultValue = '' }: LocationSearchProps) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const pacRef = useRef<any>(null);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    const ensureScript = () => {
      if (window.google && (google.maps as any).places?.PlaceAutocompleteElement) {
        initPAC();
        return;
      }
      const existing = document.querySelector('script[data-google-maps]') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', initPAC, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=es&region=MX`;
      script.async = true;
      script.defer = true;
      script.setAttribute('data-google-maps', 'true');
      script.addEventListener('load', initPAC, { once: true });
      document.head.appendChild(script);
    };

    const initPAC = () => {
      if (!hostRef.current || pacRef.current) return;
      // Use the new Places Autocomplete Element (required for new projects)
      const PacCtor = (google.maps as any).places.PlaceAutocompleteElement;
      if (!PacCtor) return;
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
    };

    ensureScript();

    return () => {
      if (pacRef.current && hostRef.current?.contains(pacRef.current)) {
        hostRef.current.removeChild(pacRef.current);
      }
      pacRef.current = null;
    };
  }, [placeholder, defaultValue, onLocationSelect]);

  return <div ref={hostRef} className="w-full" />;
};

export default LocationSearch;
