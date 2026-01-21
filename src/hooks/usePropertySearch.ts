/**
 * Hook para búsqueda paginada de propiedades
 * Usa la Edge Function property-search con PostGIS
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { MapFilters, MapBounds } from '@/types/map';
import type { PropertySummary } from '@/types/property';

interface SearchResponse {
  properties: PropertySummary[];
  total: number;
  page: number;
  totalPages: number;
}

interface UsePropertySearchOptions {
  filters?: MapFilters;
  bounds?: MapBounds | null;
  sort?: 'newest' | 'oldest' | 'price_asc' | 'price_desc';
  page?: number;
  limit?: number;
  enabled?: boolean;
}

export function usePropertySearch({
  filters = {},
  bounds = null,
  sort = 'newest',
  page = 1,
  limit = 20,
  enabled = true,
}: UsePropertySearchOptions) {
  const query = useQuery({
    queryKey: ['property-search', filters, bounds, sort, page, limit],
    enabled,
    staleTime: 60_000, // 1 minuto
    gcTime: 5 * 60_000, // 5 minutos
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,

    queryFn: async (): Promise<SearchResponse> => {
      const { data, error } = await supabase.functions.invoke('property-search', {
        body: {
          filters: {
            listing_type: filters.listing_type || null,
            property_type: filters.property_type || null,
            min_price: filters.min_price || null,
            max_price: filters.max_price || null,
            min_bedrooms: filters.min_bedrooms || null,
            state: filters.state || null,
            municipality: filters.municipality || null,
          },
          bounds,
          sort,
          page,
          limit,
        },
      });

      if (error) {
        console.error('[usePropertySearch] Error:', error);
        throw new Error(error.message || 'Failed to search properties');
      }

      return data as SearchResponse;
    },
  });

  return {
    properties: query.data?.properties || [],
    total: query.data?.total || 0,
    page: query.data?.page || 1,
    totalPages: query.data?.totalPages || 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    hasNextPage: (query.data?.page || 1) < (query.data?.totalPages || 0),
  };
}
