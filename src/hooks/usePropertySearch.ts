/**
 * Hook para búsqueda paginada de propiedades
 * ENTERPRISE: Usa search_properties RPC optimizado con:
 * - Estimated count desde materialized views (evita COUNT(*) timeout)
 * - Spatial index para filtrado geográfico O(log n)
 * - Sorting en base de datos (no en memoria)
 * - Paginación eficiente con LIMIT/OFFSET
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { monitoring } from '@/lib/monitoring';
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

/**
 * ENTERPRISE OPTIMIZATION:
 * At country level (large bounds), the ORDER BY on 745K rows is slow.
 * Skip the spatial filter for very large bounds and use indexed sorting.
 */
const LARGE_BOUNDS_THRESHOLD = 100; // degrees squared (all of Mexico is ~300)

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

  // Calculate bounds area to determine if we should use spatial filtering
  const boundsArea = validBounds
    ? Math.abs(validBounds.north - validBounds.south) * Math.abs(validBounds.east - validBounds.west)
    : 0;

  // At country level (large bounds), don't use spatial filtering - too slow
  const useSpatialFilter = validBounds && boundsArea < LARGE_BOUNDS_THRESHOLD;

  const query = useQuery({
    queryKey: ['property-search', filters, useSpatialFilter ? validBounds : null, sort, page, limit],
    enabled,
    staleTime: 60_000, // 1 minuto
    gcTime: 5 * 60_000, // 5 minutos
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,

    queryFn: async (): Promise<SearchResponse> => {
      const startTime = performance.now();
      const offset = (page - 1) * limit;

      // ENTERPRISE: Usar search_properties RPC optimizado
      // Esta función usa:
      // - Estimated count desde mv_property_counts_by_status (O(1))
      // - Spatial index con ST_MakeEnvelope para bounds (O(log n)) - only for small areas
      // - Sorting en DB, no en memoria
      const { data, error } = await supabase.rpc('search_properties', {
        p_status: 'activa',
        p_listing_type: filters.listing_type || null,
        p_property_type: filters.property_type || null,
        p_min_price: filters.min_price || null,
        p_max_price: filters.max_price || null,
        p_min_bedrooms: filters.min_bedrooms || null,
        p_state: useSpatialFilter ? null : (filters.state || null),
        p_municipality: useSpatialFilter ? null : (filters.municipality || null),
        // Only pass bounds if area is small enough for efficient spatial query
        p_bounds_north: useSpatialFilter ? validBounds?.north ?? null : null,
        p_bounds_south: useSpatialFilter ? validBounds?.south ?? null : null,
        p_bounds_east: useSpatialFilter ? validBounds?.east ?? null : null,
        p_bounds_west: useSpatialFilter ? validBounds?.west ?? null : null,
        p_sort: sort,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) {
        monitoring.error('Failed to search properties', { hook: 'usePropertySearch', error });
        throw new Error(error.message || 'Failed to search properties');
      }

      const duration = performance.now() - startTime;

      // Log slow queries for monitoring
      if (duration > 1000) {
        monitoring.warn('Slow property search', {
          duration: String(duration),
          page: String(page),
          limit: String(limit),
          hasFilters: Object.keys(filters).length > 0,
          hasBounds: !!validBounds,
          boundsArea: String(boundsArea),
          useSpatialFilter,
        });
      }

      // search_properties returns: { properties: jsonb, total_count: bigint }
      const result = data?.[0] || { properties: [], total_count: 0 };
      const properties = (result.properties as unknown as PropertySummary[]) || [];
      const total = Number(result.total_count) || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        properties,
        total,
        page,
        totalPages,
      };
    },
  });

  return {
    properties: query.data?.properties || [],
    total: query.data?.total || 0,
    page: query.data?.page || 1,
    totalPages: query.data?.totalPages || 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isPending: query.isPending,
    error: query.error as Error | null,
    hasNextPage: (query.data?.page || 1) < (query.data?.totalPages || 0),
  };
}
