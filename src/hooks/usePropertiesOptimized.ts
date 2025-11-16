/**
 * Hook optimizado para queries de propiedades
 * - Cursor-based pagination
 * - Redis cache via edge function
 * - Batch loading de imágenes
 * - Reemplaza useProperties, usePropertiesInfinite y usePropertiesSearch
 */

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PropertyFilters {
  estado?: string;
  municipio?: string;
  tipo?: string;
  listingType?: string;
  precioMin?: number;
  precioMax?: number;
  recamaras?: string;
  banos?: string;
  searchQuery?: string;
}

interface Property {
  id: string;
  title: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  lat: number | null;
  lng: number | null;
  address: string;
  state: string;
  municipality: string;
  type: string;
  listing_type: string;
  created_at: string;
  sqft: number | null;
  agent_id: string;
  for_sale: boolean;
  for_rent: boolean;
  sale_price: number | null;
  rent_price: number | null;
  currency: string;
  next_cursor: string;
  images?: { url: string; position: number }[];
  is_featured?: boolean;
}

const PAGE_SIZE = 50;

/**
 * Hook principal con cursor-based pagination e infinite scroll
 */
export const usePropertiesOptimized = (filters?: PropertyFilters) => {
  return useInfiniteQuery({
    queryKey: ['properties-optimized', filters],
    queryFn: async ({ pageParam }) => {
      // Usar función RPC optimizada con cursor
      const { data: properties, error } = await supabase.rpc('get_properties_cursor', {
        p_cursor: pageParam || null,
        p_limit: PAGE_SIZE,
        p_state: filters?.estado || null,
        p_municipality: filters?.municipio || null,
        p_type: filters?.tipo || null,
        p_listing_type: filters?.listingType || null,
        p_price_min: filters?.precioMin || null,
        p_price_max: filters?.precioMax || null,
      });

      if (error) {
        console.error('[usePropertiesOptimized] Error:', error);
        throw error;
      }

      if (!properties || properties.length === 0) {
        return { properties: [], nextCursor: null };
      }

      // Batch load de imágenes para evitar N+1
      const propertyIds = properties.map((p: any) => p.id);
      const { data: imagesData, error: imagesError } = await supabase.rpc(
        'get_images_batch',
        { property_ids: propertyIds }
      );

      if (imagesError) {
        console.error('[usePropertiesOptimized] Images error:', imagesError);
      }

      // Mapear imágenes a propiedades
      const imagesMap = new Map();
      imagesData?.forEach((item: any) => {
        imagesMap.set(item.property_id, item.images || []);
      });

      // Obtener info de featured (podría cachearse también)
      const { data: featuredData } = await supabase
        .from('featured_properties')
        .select('property_id, status, end_date')
        .in('property_id', propertyIds)
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString());

      const featuredSet = new Set(
        featuredData?.map((f: any) => f.property_id) || []
      );

      // Combinar todo
      const enrichedProperties = properties.map((property: any) => ({
        ...property,
        images: imagesMap.get(property.id) || [],
        is_featured: featuredSet.has(property.id),
      }));

      const nextCursor =
        properties.length === PAGE_SIZE
          ? properties[properties.length - 1].next_cursor
          : null;

      return {
        properties: enrichedProperties,
        nextCursor,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos en cache
  });
};

/**
 * Hook para búsqueda con Full-Text Search
 */
export const usePropertiesSearch = (filters: PropertyFilters & { searchQuery: string }) => {
  return useQuery({
    queryKey: ['properties-search-optimized', filters],
    queryFn: async () => {
      if (!filters.searchQuery || filters.searchQuery.trim().length < 2) {
        return [];
      }

      // Usar FTS optimizado
      const { data, error } = await supabase.rpc('search_properties_fts', {
        search_query: filters.searchQuery,
        p_state: filters.estado || null,
        p_municipality: filters.municipio || null,
        p_type: filters.tipo || null,
        p_listing_type: filters.listingType || null,
        p_price_min: filters.precioMin || null,
        p_price_max: filters.precioMax || null,
        p_limit: 100,
        p_offset: 0,
      });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Batch load imágenes
      const propertyIds = data.map((p: any) => p.id);
      const { data: imagesData } = await supabase.rpc('get_images_batch', {
        property_ids: propertyIds,
      });

      const imagesMap = new Map();
      imagesData?.forEach((item: any) => {
        imagesMap.set(item.property_id, item.images || []);
      });

      return data.map((property: any) => ({
        ...property,
        images: imagesMap.get(property.id) || [],
        is_featured: false,
      }));
    },
    enabled: !!filters.searchQuery && filters.searchQuery.trim().length >= 2,
    staleTime: 30000, // 30 segundos
  });
};

/**
 * Hook para obtener propiedades dentro de viewport (mapa)
 * Con debounce y cache
 */
export const usePropertiesViewportOptimized = (
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null,
  filters?: PropertyFilters
) => {
  return useQuery({
    queryKey: ['properties-viewport-optimized', bounds, filters],
    queryFn: async () => {
      if (!bounds) return [];

      let query = supabase
        .from('properties')
        .select('id, title, price, lat, lng, type, listing_type, for_sale, for_rent, images(url, position)')
        .eq('status', 'activa')
        .gte('lat', bounds.minLat)
        .lte('lat', bounds.maxLat)
        .gte('lng', bounds.minLng)
        .lte('lng', bounds.maxLng);

      if (filters?.estado) query = query.eq('state', filters.estado);
      if (filters?.municipio) query = query.eq('municipality', filters.municipio);
      if (filters?.tipo) query = query.eq('type', filters.tipo as any);
      if (filters?.listingType === 'venta') query = query.eq('for_sale', true);
      if (filters?.listingType === 'renta') query = query.eq('for_rent', true);
      if (filters?.precioMin) query = query.gte('price', filters.precioMin);
      if (filters?.precioMax) query = query.lte('price', filters.precioMax);

      const { data, error } = await query.limit(500); // Máximo 500 en viewport

      if (error) throw error;

      return data?.map((property: any) => ({
        ...property,
        images: (property.images || []).sort((a: any, b: any) => a.position - b.position),
      })) || [];
    },
    enabled: !!bounds,
    staleTime: 60000, // 1 minuto
    gcTime: 5 * 60 * 1000, // 5 minutos
  });
};

/**
 * Hook para estadísticas globales con cache pesado
 */
export const useGlobalStats = () => {
  return useQuery({
    queryKey: ['global-stats'],
    queryFn: async () => {
      // Intentar desde edge function cacheada primero
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-cached-stats`,
          {
            headers: {
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
            },
          }
        );

        if (response.ok) {
          return await response.json();
        }
      } catch (error) {
        console.warn('[useGlobalStats] Edge function failed, using direct query');
      }

      // Fallback a query directa
      const [propertiesCount, agentsCount] = await Promise.all([
        supabase
          .from('properties')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'activa'),
        supabase
          .from('user_roles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'agent'),
      ]);

      return {
        totalProperties: propertiesCount.count || 0,
        totalAgents: agentsCount.count || 0,
      };
    },
    staleTime: 60 * 60 * 1000, // 1 hora - las stats no cambian tan rápido
    gcTime: 2 * 60 * 60 * 1000, // 2 horas
  });
};
