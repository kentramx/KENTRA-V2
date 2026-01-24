/**
 * Hook para obtener clusters/propiedades del mapa
 * ENTERPRISE: Enfoque híbrido para 1M+ propiedades
 *
 * ARQUITECTURA:
 * - zoom < 10: Usa get-clusters con clusters pre-computados (rápido, 155K props)
 * - zoom >= 10: Usa cluster-properties con Supercluster (más detalle, área pequeña)
 * - Cache de 60s client-side, 300s CDN
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDebouncedValue } from './useDebouncedValue';
import { monitoring } from '@/lib/monitoring';
import type { MapViewport, MapFilters, PropertyMarker, PropertyCluster, MapBounds } from '@/types/map';

interface MapClustersResponse {
  clusters: PropertyCluster[];
  properties: PropertyMarker[];
  total: number;
  is_clustered: boolean;
  _meta?: {
    zoom: number;
    duration: number;
    source: 'properties' | 'pre-computed' | 'synthetic';
  };
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

// Calculate viewport area in degrees squared
function getViewportArea(bounds: MapBounds): number {
  return Math.abs(bounds.north - bounds.south) * Math.abs(bounds.east - bounds.west);
}

/**
 * ENTERPRISE ARCHITECTURE FOR 1M+ PROPERTIES
 *
 * Zoom Level Strategy:
 * - zoom < 4: Don't query (too zoomed out to be useful)
 * - zoom 4-9: Use get-clusters (pre-computed OR synthetic fallback)
 * - zoom 10-13: Use cluster-properties with Supercluster (small area)
 * - zoom 14+: Show individual properties (very small area)
 *
 * This prevents timeout at country level and provides Zillow-like performance
 */
const ZOOM_THRESHOLD_MIN = 4;  // Below this, don't query at all
const ZOOM_THRESHOLD_PRECOMPUTED = 10;  // Below this, use pre-computed/synthetic
const MAX_AREA_FOR_REALTIME = 5;  // Maximum area (degrees²) for real-time clustering

export function useMapClusters({
  viewport,
  filters = {},
  enabled = true,
}: UseMapClustersOptions) {
  // Debounce de 200ms para UX más responsive
  const debouncedViewport = useDebouncedValue(viewport, 200);

  // Validate bounds are complete
  const hasValidBounds = debouncedViewport !== null && isValidBounds(debouncedViewport.bounds);
  const zoom = debouncedViewport?.zoom || 0;
  const area = hasValidBounds ? getViewportArea(debouncedViewport!.bounds) : 0;

  // At very low zoom (< 4), don't query - too zoomed out
  const shouldQuery = enabled && hasValidBounds && zoom >= ZOOM_THRESHOLD_MIN;

  const query = useQuery({
    queryKey: ['map-clusters', debouncedViewport, filters],
    enabled: shouldQuery,
    staleTime: 60_000, // 1 minuto - clusters pre-computados no cambian frecuentemente
    gcTime: 5 * 60_000, // 5 minutos
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,

    queryFn: async (): Promise<MapClustersResponse> => {
      if (!debouncedViewport || !isValidBounds(debouncedViewport.bounds)) {
        return { clusters: [], properties: [], total: 0, is_clustered: false };
      }

      const startTime = performance.now();
      const currentZoom = debouncedViewport.zoom;
      const currentArea = getViewportArea(debouncedViewport.bounds);

      // ENTERPRISE STRATEGY:
      // - zoom < 10 OR area > 5: use get-clusters (pre-computed, fast)
      // - zoom >= 10 AND area <= 5: use cluster-properties (real-time, accurate)
      const usePrecomputed = currentZoom < ZOOM_THRESHOLD_PRECOMPUTED || currentArea > MAX_AREA_FOR_REALTIME;
      const functionName = usePrecomputed ? 'get-clusters' : 'cluster-properties';

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          bounds: debouncedViewport.bounds,
          zoom: currentZoom,
          filters: {
            listing_type: filters.listing_type || null,
            property_type: filters.property_type || null,
            min_price: filters.min_price || null,
            max_price: filters.max_price || null,
            min_bedrooms: filters.min_bedrooms || null,
          },
        },
      });

      if (error) {
        monitoring.error('Failed to fetch map clusters', {
          hook: 'useMapClusters',
          error,
          function: functionName
        });
        throw new Error(error.message || 'Failed to fetch map data');
      }

      const duration = performance.now() - startTime;

      // Log performance for monitoring
      if (duration > 500) {
        monitoring.warn('Slow cluster fetch', {
          duration,
          zoom: currentZoom,
          area: currentArea,
          function: functionName,
          source: data?._meta?.source
        });
      }

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
    isPending: query.isPending,
    isIdle: !query.isFetching && !query.isLoading && !query.data,
    error: query.error as Error | null,
    // Metadata para debugging
    _meta: query.data?._meta,
  };
}
