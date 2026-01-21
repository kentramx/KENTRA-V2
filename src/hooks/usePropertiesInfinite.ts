/**
 * Hook para carga infinita de propiedades
 * Compatible con Home.tsx que usa data.pages.flatMap()
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import type { PropertySummary } from '@/types/property';

interface SearchResponse {
  properties: PropertySummary[];
  total: number;
  page: number;
  totalPages: number;
}

interface UsePropertiesInfiniteOptions {
  status?: string[];
  listing_type?: string;
  property_type?: string;
  limit?: number;
  enabled?: boolean;
}

export function usePropertiesInfinite({
  status = ['activa'],
  listing_type,
  property_type,
  limit = 20,
  enabled = true,
}: UsePropertiesInfiniteOptions = {}) {
  return useInfiniteQuery({
    queryKey: ['properties-infinite', status, listing_type, property_type, limit],
    enabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    initialPageParam: 1,

    queryFn: async ({ pageParam = 1 }): Promise<SearchResponse> => {
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
              listing_type: listing_type || null,
              property_type: property_type || null,
            },
            sort: 'newest',
            page: pageParam,
            limit,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch properties');
      }

      return response.json();
    },

    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
  });
}
