/**
 * Hook para carga infinita de propiedades
 * Compatible con Home.tsx que usa data.pages.flatMap()
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
      const { data, error } = await supabase.functions.invoke('property-search', {
        body: {
          filters: {
            listing_type: listing_type || null,
            property_type: property_type || null,
          },
          sort: 'newest',
          page: pageParam,
          limit,
        },
      });

      if (error) {
        console.error('[usePropertiesInfinite] Error:', error);
        throw new Error(error.message || 'Failed to fetch properties');
      }

      return data as SearchResponse;
    },

    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
  });
}
