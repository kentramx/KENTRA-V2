import { useState, useCallback } from 'react';

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

export const useSearchState = (searchParams: URLSearchParams) => {
  const [filters, setFilters] = useState<Filters>({
    estado: searchParams.get('estado') || '',
    municipio: searchParams.get('municipio') || '',
    precioMin: searchParams.get('precioMin') || '',
    precioMax: searchParams.get('precioMax') || '',
    tipo: searchParams.get('tipo') || '',
    listingType: searchParams.get('listingType') || '',
    recamaras: searchParams.get('recamaras') || '',
    banos: searchParams.get('banos') || '',
    orden: (searchParams.get('orden') as Filters['orden']) || 'newest',
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const updateFilter = useCallback((key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      estado: '',
      municipio: '',
      precioMin: '',
      precioMax: '',
      tipo: '',
      listingType: '',
      recamaras: '',
      banos: '',
      orden: 'newest',
    });
    setCurrentPage(1);
  }, []);

  return {
    filters,
    setFilters,
    updateFilter,
    resetFilters,
    currentPage,
    setCurrentPage,
    viewMode,
    setViewMode,
  };
};
