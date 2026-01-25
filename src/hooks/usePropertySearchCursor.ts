/**
 * Hook para búsqueda de propiedades con paginación cursor-based
 * SCALABILITY: O(1) pagination para 500K+ propiedades
 *
 * Usa useInfiniteQuery para infinite scroll eficiente
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { monitoring } from '@/lib/monitoring';
import type { MapFilters, MapBounds } from '@/types/map';
import type { PropertySummary } from '@/types/property';

interface PageSearchResponse {
  properties: PropertySummary[];
  total: number;
  page: number;
  pages: number;
}

interface UsePropertySearchCursorOptions {
  filters?: MapFilters;
  bounds?: MapBounds | null;
  sort?: 'newest' | 'oldest' | 'price_asc' | 'price_desc';
  limit?: number;
  enabled?: boolean;
}

function isValidBounds(bounds: MapBounds | null | undefined): bounds is MapBounds {
  if (!bounds) return false;
  return (
    typeof bounds.north === 'number' && !isNaN(bounds.north) &&
    typeof bounds.south === 'number' && !isNaN(bounds.south) &&
    typeof bounds.east === 'number' && !isNaN(bounds.east) &&
    typeof bounds.west === 'number' && !isNaN(bounds.west)
  );
}

/**
 * Cursor-based property search for infinite scroll
 *
 * Usage:
 * ```tsx
 * const {
 *   properties,
 *   fetchNextPage,
 *   hasNextPage,
 *   isFetchingNextPage
 * } = usePropertySearchCursor({ filters, bounds });
 *
 * // In scroll handler or intersection observer:
 * if (hasNextPage && !isFetchingNextPage) {
 *   fetchNextPage();
 * }
 * ```
 */
export function usePropertySearchCursor({
  filters = {},
  bounds = null,
  sort = 'newest',
  limit = 20,
  enabled = true,
}: UsePropertySearchCursorOptions) {
  const validBounds = isValidBounds(bounds) ? bounds : null;

  // Map sort format
  const sortMap: Record<string, string> = {
    newest: '-created_at',
    oldest: 'created_at',
    price_asc: 'price',
    price_desc: '-price',
  };

  const query = useInfiniteQuery({
    queryKey: ['property-search-cursor', filters, validBounds, sort, limit],
    enabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,

    queryFn: async ({ pageParam = 1 }): Promise<PageSearchResponse> => {
      const { data, error } = await supabase.functions.invoke('search-properties', {
        body: {
          query: '',
          filters: {
            listing_type: filters.listing_type || null,
            property_type: filters.property_type || null,
            min_price: filters.min_price || null,
            max_price: filters.max_price || null,
            min_bedrooms: filters.min_bedrooms || null,
            state: validBounds ? null : (filters.state || null),
            city: validBounds ? null : (filters.municipality || null),
          },
          bounds: validBounds || undefined,
          sort: sortMap[sort] || '-created_at',
          page: pageParam,
          limit,
        },
      });

      if (error) {
        monitoring.error('Failed to search properties (cursor)', { hook: 'usePropertySearchCursor', error });
        throw new Error(error.message || 'Failed to search properties');
      }

      return data as PageSearchResponse;
    },

    initialPageParam: 1,

    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.pages) {
        return lastPage.page + 1;
      }
      return undefined;
    },

    getPreviousPageParam: (firstPage) => {
      if (firstPage.page > 1) {
        return firstPage.page - 1;
      }
      return undefined;
    },
  });

  // Flatten all pages into a single array of properties
  const allProperties = query.data?.pages.flatMap(page => page.properties) || [];
  const total = query.data?.pages[0]?.total || 0;

  return {
    properties: allProperties,
    total,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    error: query.error as Error | null,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    // Utility: check if we've loaded any data
    isEmpty: !query.isLoading && allProperties.length === 0,
    // Utility: estimate progress (may not be 100% accurate with cursor pagination)
    loadedCount: allProperties.length,
  };
}
