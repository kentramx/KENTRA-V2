/**
 * Hook para obtener datos del mapa con server-side clustering
 * FUENTE ÚNICA DE DATOS para mapa Y lista (arquitectura Zillow)
 * KENTRA MAP STACK - OFICIAL
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

export function useMapData({ 
  viewport, 
  filters = {}, 
  enabled = true 
}: UseMapDataOptions) {
  
  const debouncedViewport = useDebouncedValue(
    viewport, 
    GOOGLE_MAPS_CONFIG.debounce.boundsChange
  );
  
  const shouldQuery = enabled && 
    debouncedViewport !== null && 
    debouncedViewport.zoom >= GOOGLE_MAPS_CONFIG.zoom.minForQueries;

  const query = useQuery({
    queryKey: ['map-data', debouncedViewport, filters],
    enabled: shouldQuery,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
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
          is_clustered: false,
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
        p_price_min: filters.min_price || null,
        p_price_max: filters.max_price || null,
        p_bedrooms: filters.min_bedrooms || null,
        p_bathrooms: filters.min_bathrooms || null,
        p_state: filters.state || null,
        p_municipality: filters.municipality || null,
        p_colonia: filters.colonia || null,
      });

      if (error) {
        console.error('[useMapData] Error:', error);
        throw new Error(error.message);
      }

      const response = data as any;
      
      // Mapear propiedades con position en images
      const properties: PropertyMarker[] = (response?.properties || []).map((p: any) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        price: p.price || 0,
        currency: p.currency || 'MXN',
        title: p.title || '',
        listing_type: p.listing_type || 'venta',
        type: p.type || 'casa',
        address: p.address || '',
        colonia: p.colonia || null,
        municipality: p.municipality || '',
        state: p.state || '',
        bedrooms: p.bedrooms ?? null,
        bathrooms: p.bathrooms ?? null,
        parking: p.parking ?? null,
        sqft: p.sqft ?? null,
        for_sale: p.for_sale ?? true,
        for_rent: p.for_rent ?? false,
        sale_price: p.sale_price ?? null,
        rent_price: p.rent_price ?? null,
        images: Array.isArray(p.images) 
          ? p.images.map((img: any, idx: number) => ({
              url: typeof img === 'string' ? img : img.url,
              position: typeof img === 'object' ? img.position : idx
            }))
          : [],
        agent_id: p.agent_id || '',
        is_featured: p.is_featured ?? false,
        created_at: p.created_at || '',
        image_url: p.image_url,
      }));

      // Mapear clusters con IDs únicos
      const clusters: PropertyCluster[] = (response?.clusters || []).map((c: any, index: number) => ({
        id: c.id || `cluster-${index}-${c.lat}-${c.lng}`,
        lat: c.lat,
        lng: c.lng,
        count: c.count || c.property_count || 0,
        avg_price: c.avg_price || 0,
        min_price: c.min_price,
        max_price: c.max_price,
        expansion_zoom: c.expansion_zoom || Math.min((debouncedViewport?.zoom || 10) + 2, 14),
      }));
      
      return {
        properties,
        clusters,
        total_in_viewport: response?.total_count || 0,
        is_clustered: response?.is_clustered ?? false,
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
