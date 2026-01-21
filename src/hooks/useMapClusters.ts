/**
 * Hook para obtener clusters/propiedades del mapa
 * Usa la Edge Function cluster-properties con PostGIS
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useDebouncedValue } from './useDebouncedValue';
import type { MapViewport, MapFilters, PropertyMarker, PropertyCluster } from '@/types/map';

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

export function useMapClusters({
  viewport,
  filters = {},
  enabled = true,
}: UseMapClustersOptions) {
  // Debounce de 200ms para UX más responsive
  const debouncedViewport = useDebouncedValue(viewport, 200);

  const query = useQuery({
    queryKey: ['map-clusters', debouncedViewport, filters],
    enabled: enabled && debouncedViewport !== null && debouncedViewport.zoom >= 4,
    staleTime: 60_000, // 1 minuto
    gcTime: 5 * 60_000, // 5 minutos
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,

    queryFn: async (): Promise<MapClustersResponse> => {
      if (!debouncedViewport) {
        return { clusters: [], properties: [], total: 0, is_clustered: false };
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cluster-properties`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
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
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch map data');
      }

      return response.json();
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
