/**
 * ✅ Hook inteligente que decide entre búsqueda normal o por viewport
 * - Si searchByMap = false: usa usePropertySearch (paginación infinita)
 * - Si searchByMap = true: usa usePropertiesViewport (bounded search)
 */

import { useMemo } from 'react';
import { usePropertySearch } from './usePropertySearch';
import { usePropertiesViewport, ViewportBounds } from './usePropertiesViewport';
import type { PropertyFilters, PropertySummary } from '@/types/property';

interface UseSmartPropertySearchParams {
  filters: PropertyFilters;
  searchByMap: boolean;
  mapBounds: ViewportBounds | null;
}

const MAX_RESULTS = 300;

export const useSmartPropertySearch = ({
  filters,
  searchByMap,
  mapBounds,
}: UseSmartPropertySearchParams) => {
  // Búsqueda normal (paginación infinita)
  const normalSearch = usePropertySearch(filters);
  
  // Búsqueda por viewport (bounded)
  const viewportSearch = usePropertiesViewport(
    searchByMap ? mapBounds : null,
    filters
  );

  // Decidir qué resultado usar
  if (searchByMap && mapBounds) {
    const { data: viewportData, isLoading, error } = viewportSearch;
    const rawProperties = viewportData?.properties || [];
    
    // ✅ Convertir MapProperty[] a PropertySummary[] para compatibilidad
    const properties: PropertySummary[] = rawProperties.map((p) => ({
      id: p.id,
      title: p.title,
      price: p.price,
      currency: p.currency,
      type: p.type,
      listing_type: p.listing_type,
      for_sale: true, // Default, MapProperty no tiene este campo
      for_rent: false, // Default
      sale_price: null,
      rent_price: null,
      address: p.address,
      colonia: null, // MapProperty no tiene colonia
      municipality: p.municipality,
      state: p.state,
      lat: p.lat,
      lng: p.lng,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      parking: p.parking,
      sqft: p.sqft,
      images: p.images,
      agent_id: p.agent_id,
      is_featured: p.is_featured,
      created_at: p.created_at,
    }));
    
    const actualTotal = properties.length;
    const hasTooManyResults = actualTotal > MAX_RESULTS;
    
    return {
      properties: hasTooManyResults ? properties.slice(0, MAX_RESULTS) : properties,
      isLoading,
      isFetching: isLoading,
      error: error as Error | null,
      totalCount: Math.min(actualTotal, MAX_RESULTS),
      hasNextPage: false, // No hay paginación en modo mapa
      fetchNextPage: () => {},
      hasTooManyResults,
      actualTotal,
    };
  }

  // Modo normal
  return normalSearch;
};