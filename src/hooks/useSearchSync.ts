import { useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

interface Filters {
  estado: string;
  municipio: string;
  precioMin: string;
  precioMax: string;
  tipo: string;
  listingType: string;
  recamaras: string;
  banos: string;
  orden: 'price_desc' | 'price_asc' | 'newest' | 'oldest' | 'bedrooms_desc' | 'sqft_desc';
}

export const useSearchSync = (
  filters: Filters,
  selectedProperty: string | null,
  setIsFiltering: (value: boolean) => void
) => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Sincronizar filtros con URL
  useEffect(() => {
    setIsFiltering(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });

      if (selectedProperty) {
        params.set('propertyId', selectedProperty);
      }

      setSearchParams(params, { replace: true });
      setIsFiltering(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [filters, selectedProperty, setSearchParams, setIsFiltering]);

  const updateUrlWithProperty = useCallback((propertyId: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (propertyId) {
      params.set('propertyId', propertyId);
    } else {
      params.delete('propertyId');
    }
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  return { updateUrlWithProperty };
};
