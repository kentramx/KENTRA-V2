/**
 * Hook para búsqueda paginada de propiedades
 * Usa la Edge Function property-search con PostGIS
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query';
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
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/property-search`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
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
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to search properties');
      }

      return response.json();
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
