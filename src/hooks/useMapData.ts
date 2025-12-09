/**
 * KENTRA MAP DATA HOOK
 * Hook para obtener datos del mapa con clustering server-side
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MapBounds, MapData, MapFilters } from '@/types/map';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

interface UseMapDataParams {
  bounds: MapBounds | null;
  zoom: number;
  filters?: MapFilters;
  enabled?: boolean;
}

// Normaliza bounds a 3 decimales para cache estable (~111m precisión)
const normalizeBounds = (bounds: MapBounds): string => {
  return `${bounds.north.toFixed(3)}_${bounds.south.toFixed(3)}_${bounds.east.toFixed(3)}_${bounds.west.toFixed(3)}`;
};

export function useMapData({
  bounds,
  zoom,
  filters = {},
  enabled = true,
}: UseMapDataParams) {
  // Debounce bounds para evitar spam de requests
  const debouncedBounds = useDebouncedValue(bounds, 300);

  return useQuery({
    queryKey: [
      'map-data',
      debouncedBounds ? normalizeBounds(debouncedBounds) : null,
      Math.floor(zoom),
      JSON.stringify(filters),
    ],
    queryFn: async (): Promise<MapData> => {
      if (!debouncedBounds) {
        return { properties: [], clusters: [], total_count: 0, is_clustered: false };
      }

      const { data, error } = await supabase.rpc('get_map_data', {
        p_north: debouncedBounds.north,
        p_south: debouncedBounds.south,
        p_east: debouncedBounds.east,
        p_west: debouncedBounds.west,
        p_zoom: Math.floor(zoom),
        p_listing_type: filters.listing_type || null,
        p_property_type: filters.property_type || null,
        p_price_min: filters.price_min || null,
        p_price_max: filters.price_max || null,
        p_bedrooms_min: filters.bedrooms_min || null,
        p_bathrooms_min: filters.bathrooms_min || null,
        p_state: filters.state || null,
        p_municipality: filters.municipality || null,
      });

      if (error) {
        console.error('[useMapData] Error fetching map data:', error);
        throw error;
      }

      // Type assertion - el RPC devuelve JSONB que coincide con MapData
      const result = data as unknown as MapData;
      
      return {
        properties: result.properties || [],
        clusters: result.clusters || [],
        total_count: result.total_count || 0,
        is_clustered: result.is_clustered || false,
      };
    },
    enabled: enabled && !!debouncedBounds,
    staleTime: 30 * 1000, // 30 segundos
    gcTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false,
    retry: 2,
  });
}
