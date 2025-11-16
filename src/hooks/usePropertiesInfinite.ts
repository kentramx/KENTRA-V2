/**
 * Hook OPTIMIZADO con cursor-based pagination
 * Elimina offset-based y agrega batch loading
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PropertyFilters } from '@/types/property';

const PAGE_SIZE = 50;

export const usePropertiesInfinite = (filters?: PropertyFilters) => {
  return useInfiniteQuery({
    queryKey: ['properties-infinite', filters],
    queryFn: async ({ pageParam }) => {
      // ✅ OPTIMIZACIÓN: Cursor-based en lugar de offset
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
        console.error('[usePropertiesInfinite] Error:', error);
        throw error;
      }

      if (!properties || properties.length === 0) {
        return { properties: [], nextPage: null, totalCount: 0 };
      }

      // ✅ OPTIMIZACIÓN: Batch load de imágenes (elimina N+1)
      const propertyIds = properties.map((p: any) => p.id);
      const { data: imagesData } = await supabase.rpc('get_images_batch', {
        property_ids: propertyIds,
      });

      const imagesMap = new Map();
      imagesData?.forEach((item: any) => {
        imagesMap.set(item.property_id, item.images || []);
      });

      // Cargar featured
      const { data: featuredData } = await supabase
        .from('featured_properties')
        .select('property_id, status, end_date')
        .in('property_id', propertyIds)
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString());

      const featuredSet = new Set(
        featuredData?.map((f: any) => f.property_id) || []
      );

      // Normalizar
      const enrichedProperties = properties.map((property: any) => ({
        ...property,
        type: property.type === 'local_comercial' ? 'local' : property.type,
        images: imagesMap.get(property.id) || [],
        is_featured: featuredSet.has(property.id),
      }));

      const nextCursor = properties.length === PAGE_SIZE 
        ? properties[properties.length - 1].next_cursor 
        : null;

      return {
        properties: enrichedProperties,
        nextPage: nextCursor,
        totalCount: enrichedProperties.length, // Aproximado
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: null,
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });
};
