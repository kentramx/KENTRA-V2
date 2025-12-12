/**
 * Hook para obtener datos del mapa con server-side clustering
 * 
 * CARACTERÍSTICAS:
 * - Debounce de 300ms en cambios de viewport
 * - Cache de 5 minutos con React Query
 * - Placeholder data para evitar parpadeos
 * - Manejo robusto de errores
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GOOGLE_MAPS_CONFIG } from '@/config/googleMaps';
import type { MapViewport, MapFilters, MapDataResponse, PropertyMarker, PropertyCluster } from '@/types/map';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

interface UseMapDataOptions {
  viewport: MapViewport | null;
  filters?: MapFilters;
  enabled?: boolean;
}

interface UseMapDataResult {
  data: MapDataResponse | null;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  isStale: boolean;
}

export function useMapData({ 
  viewport, 
  filters = {}, 
  enabled = true 
}: UseMapDataOptions): UseMapDataResult {
  
  // Debounce del viewport para evitar queries excesivos
  const debouncedViewport = useDebouncedValue(
    viewport, 
    GOOGLE_MAPS_CONFIG.debounce.boundsChange
  );
  
  // Verificar si el zoom es suficiente para hacer queries
  const shouldQuery = enabled && 
    debouncedViewport !== null && 
    debouncedViewport.zoom >= GOOGLE_MAPS_CONFIG.zoom.minForQueries;

  const query = useQuery({
    queryKey: ['map-data', debouncedViewport, filters],
    enabled: shouldQuery,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 30 * 60 * 1000,   // 30 minutos
    retry: 2,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    
    queryFn: async (): Promise<MapDataResponse> => {
      if (!debouncedViewport) {
        return {
          properties: [],
          clusters: [],
          total_in_viewport: 0,
          truncated: false,
        };
      }

      const { bounds, zoom } = debouncedViewport;

      const { data, error } = await supabase.rpc('get_map_data', {
        p_north: bounds.north,
        p_south: bounds.south,
        p_east: bounds.east,
        p_west: bounds.west,
        p_zoom: zoom,
        p_listing_type: filters.listing_type || null,
        p_property_type: filters.property_type || null,
        p_min_price: filters.min_price || null,
        p_max_price: filters.max_price || null,
        p_bedrooms: filters.min_bedrooms || null,
        p_bathrooms: filters.min_bathrooms || null,
        p_state: filters.state || null,
        p_municipality: filters.municipality || null,
      });

      if (error) {
        console.error('[useMapData] Error:', error);
        throw new Error(error.message);
      }

      // Parsear respuesta - el data viene como JSONB
      const response = data as any;
      
      // Mapear propiedades
      const properties: PropertyMarker[] = (response?.properties || []).map((p: any) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        price: p.price || 0,
        currency: p.currency || 'MXN',
        title: p.title || '',
        listing_type: p.listing_type || 'venta',
        type: p.type || 'casa',
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        image_url: p.image_url,
      }));

      // Mapear clusters
      const clusters: PropertyCluster[] = (response?.clusters || []).map((c: any) => ({
        id: c.id,
        lat: c.lat,
        lng: c.lng,
        count: c.count || 0,
        avg_price: c.avg_price || 0,
        expansion_zoom: c.expansion_zoom || Math.min(zoom + 2, 14),
      }));
      
      return {
        properties,
        clusters,
        total_in_viewport: response?.total_in_viewport || 0,
        truncated: response?.truncated || false,
      };
    },
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    isStale: query.isStale,
  };
}
