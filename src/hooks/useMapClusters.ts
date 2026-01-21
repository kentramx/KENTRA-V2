/**
 * Hook para obtener clusters/propiedades del mapa
 * Usa la Edge Function cluster-properties con PostGIS
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDebouncedValue } from './useDebouncedValue';
import type { MapViewport, MapFilters, PropertyMarker, PropertyCluster, MapBounds } from '@/types/map';

interface MapClustersResponse {
  clusters: PropertyCluster[];
  properties: PropertyMarker[];
  total: number;
  is_clustered: boolean;
}

interface UseMapClustersOptions {
  viewport: MapViewport | null;
  filters?: MapFilters;
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

export function useMapClusters({
  viewport,
  filters = {},
  enabled = true,
}: UseMapClustersOptions) {
  // Debounce de 200ms para UX más responsive
  const debouncedViewport = useDebouncedValue(viewport, 200);

  // Validate bounds are complete
  const hasValidBounds = debouncedViewport !== null && isValidBounds(debouncedViewport.bounds);

  const query = useQuery({
    queryKey: ['map-clusters', debouncedViewport, filters],
    // Only enable when we have valid, complete bounds
    enabled: enabled && hasValidBounds && debouncedViewport!.zoom >= 4,
    staleTime: 60_000, // 1 minuto
    gcTime: 5 * 60_000, // 5 minutos
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,

    queryFn: async (): Promise<MapClustersResponse> => {
      if (!debouncedViewport || !isValidBounds(debouncedViewport.bounds)) {
        console.warn('[useMapClusters] Invalid bounds:', debouncedViewport?.bounds);
        return { clusters: [], properties: [], total: 0, is_clustered: false };
      }

      console.log('[useMapClusters] Fetching with bounds:', debouncedViewport.bounds);

      const { data, error } = await supabase.functions.invoke('cluster-properties', {
        body: {
          bounds: debouncedViewport.bounds,
          zoom: debouncedViewport.zoom,
          filters: {
            listing_type: filters.listing_type || null,
            property_type: filters.property_type || null,
            min_price: filters.min_price || null,
            max_price: filters.max_price || null,
            min_bedrooms: filters.min_bedrooms || null,
            state: filters.state || null,
            municipality: filters.municipality || null,
          },
        },
      });

      if (error) {
        console.error('[useMapClusters] Error:', error);
        throw new Error(error.message || 'Failed to fetch map data');
      }

      console.log('[useMapClusters] Response:', data);
      return data as MapClustersResponse;
    },
  });

  return {
    clusters: query.data?.clusters || [],
    properties: query.data?.properties || [],
    total: query.data?.total || 0,
    isClustered: query.data?.is_clustered || false,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
  };
}
