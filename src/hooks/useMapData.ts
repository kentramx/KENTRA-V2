/**
 * Hook para obtener datos del mapa con server-side clustering
 * FUENTE ÚNICA DE DATOS para mapa Y lista (arquitectura Zillow)
 * KENTRA MAP STACK - OFICIAL
 * 
 * Usa Edge Function cluster-properties con Supercluster (algoritmo Mapbox)
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query';
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

  // Detectar si hay un viewport pendiente de debounce
  // Caso 1: viewport existe pero debouncedViewport aún no (primera carga)
  // Caso 2: ambos existen pero son diferentes (cambio de viewport)
  const isViewportPending = viewport !== null && (
    debouncedViewport === null || 
    JSON.stringify(viewport) !== JSON.stringify(debouncedViewport)
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

      // Call Edge Function with Supercluster clustering
      const fetchResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cluster-properties`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            bounds: {
              north: bounds.north,
              south: bounds.south,
              east: bounds.east,
              west: bounds.west,
            },
            zoom,
            filters: {
              listing_type: filters.listing_type || null,
              property_type: filters.property_type || null,
              min_price: filters.min_price || null,
              max_price: filters.max_price || null,
              min_bedrooms: filters.min_bedrooms || null,
              min_bathrooms: filters.min_bathrooms || null,
              state: filters.state || null,
              municipality: filters.municipality || null,
              colonia: filters.colonia || null,
            },
          }),
        }
      );

      if (!fetchResponse.ok) {
        const errorData = await fetchResponse.json().catch(() => ({}));
        console.error('[useMapData] Edge Function error:', errorData);
        throw new Error(errorData.error || 'Failed to fetch map data');
      }

      const data = await fetchResponse.json();
      
      // Mapear propiedades con position en images
      const properties: PropertyMarker[] = (data?.properties || []).map((p: any) => ({
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
      const clusters: PropertyCluster[] = (data?.clusters || []).map((c: any, index: number) => ({
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
        total_in_viewport: data?.total_count || 0,
        is_clustered: data?.is_clustered ?? false,
      };
    },
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isPending: isViewportPending, // true cuando hay viewport esperando debounce
    isIdle: !shouldQuery, // Query deshabilitado (esperando viewport válido)
    error: query.error as Error | null,
    isStale: query.isStale,
  };
}
