/**
 * Hook OPTIMIZADO con cursor-based pagination
 * Elimina offset-based y agrega batch loading
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PropertyFilters, PropertySummary } from '@/types/property';
import { monitoring } from '@/lib/monitoring';

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
        monitoring.error('[usePropertiesInfinite] Error', { hook: 'usePropertiesInfinite', error });
        throw error;
      }

      if (!properties || properties.length === 0) {
        return { properties: [], nextPage: null, totalCount: 0 };
      }

      // ✅ OPTIMIZACIÓN: Batch load de imágenes (elimina N+1)
      const propertyIds = (properties as any[]).map((p) => p.id);
      const { data: imagesData } = await supabase.rpc('get_images_batch', {
        property_ids: propertyIds,
      });

      interface ImageBatch {
        property_id: string;
        images: Array<{ url: string; position: number }>;
      }

      const imagesMap = new Map<string, Array<{ url: string; position: number }>>();
      (imagesData as ImageBatch[] || []).forEach((item) => {
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
        featuredData?.map((f) => f.property_id) || []
      );

      // Normalizar a PropertySummary
      const enrichedProperties: PropertySummary[] = (properties as any[]).map((property) => ({
        id: property.id,
        title: property.title,
        price: property.price,
        currency: property.currency || 'MXN',
        type: property.type === 'local_comercial' ? 'local' : property.type,
        listing_type: property.listing_type,
        for_sale: property.for_sale ?? true,
        for_rent: property.for_rent ?? false,
        sale_price: property.sale_price,
        rent_price: property.rent_price,
        address: property.address,
        colonia: property.colonia,
        municipality: property.municipality,
        state: property.state,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        parking: property.parking,
        sqft: property.sqft,
        agent_id: property.agent_id,
        created_at: property.created_at,
        images: imagesMap.get(property.id) || [],
        is_featured: featuredSet.has(property.id),
      }));

      const nextCursor = properties.length === PAGE_SIZE 
        ? (properties[properties.length - 1] as any).next_cursor 
        : null;

      return {
        properties: enrichedProperties,
        nextPage: nextCursor,
        totalCount: enrichedProperties.length,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: null,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};
