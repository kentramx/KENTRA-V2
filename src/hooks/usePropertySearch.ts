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

// Validate that bounds has all four required values
function isValidBounds(bounds: MapBounds | null | undefined): bounds is MapBounds {
  if (!bounds) return false;
  return (
    typeof bounds.north === 'number' && !isNaN(bounds.north) &&
    typeof bounds.south === 'number' && !isNaN(bounds.south) &&
    typeof bounds.east === 'number' && !isNaN(bounds.east) &&
    typeof bounds.west === 'number' && !isNaN(bounds.west)
  );
}

export function usePropertySearch({
  filters = {},
  bounds = null,
  sort = 'newest',
  page = 1,
  limit = 20,
  enabled = true,
}: UsePropertySearchOptions) {
  // Only use bounds if they're valid and complete
  const validBounds = isValidBounds(bounds) ? bounds : null;

  const query = useQuery({
    queryKey: ['property-search', filters, validBounds, sort, page, limit],
    enabled,
    staleTime: 60_000, // 1 minuto
    gcTime: 5 * 60_000, // 5 minutos
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,

    queryFn: async (): Promise<SearchResponse> => {
      console.log('[usePropertySearch] Fetching with bounds:', validBounds);

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
          bounds: validBounds,
          sort,
          page,
          limit,
        },
      });

      if (error) {
        console.error('[usePropertySearch] Error:', error);
        throw new Error(error.message || 'Failed to search properties');
      }

      console.log('[usePropertySearch] Response total:', data?.total);
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
