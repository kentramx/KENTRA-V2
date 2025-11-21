/**
 * Hook OPTIMIZADO con validación explícita de filtros
 * Evita aplicar filtros vacíos que causan "No encontramos propiedades"
 */

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PropertyFilters, PropertySummary } from '@/types/property';
import { monitoring } from '@/lib/monitoring';

const PAGE_SIZE = 20;

// Hook separado para obtener el total count (se ejecuta una sola vez)
const useTotalCount = (filters?: PropertyFilters) => {
  return useQuery({
    queryKey: ['properties-total-count', filters],
    queryFn: async () => {
      let query = supabase
        .from('properties')
        .select('*', { count: 'exact', head: true });

      // ✅ SIEMPRE filtrar por activas
      query = query.eq('status', 'activa');

      // ✅ Solo aplicar filtros si tienen valor real
      if (filters?.estado && filters.estado.trim() !== '') {
        query = query.eq('state', filters.estado);
      }

      if (filters?.municipio && filters.municipio.trim() !== '') {
        query = query.eq('municipality', filters.municipio);
      }

      if (filters?.tipo && filters.tipo.trim() !== '') {
        query = query.eq('type', filters.tipo as any);
      }

      if (filters?.listingType && filters.listingType.trim() !== '') {
        query = query.eq('listing_type', filters.listingType);
      }

      const minPrice = Number(filters?.precioMin);
      if (!isNaN(minPrice) && minPrice > 0) {
        query = query.gte('price', minPrice);
      }

      const maxPrice = Number(filters?.precioMax);
      if (!isNaN(maxPrice) && maxPrice > 0) {
        query = query.lte('price', maxPrice);
      }

      const beds = Number(filters?.recamaras);
      if (!isNaN(beds) && beds > 0) {
        query = query.gte('bedrooms', beds);
      }

      const baths = Number(filters?.banos);
      if (!isNaN(baths) && baths > 0) {
        query = query.gte('bathrooms', baths);
      }

      const { count, error } = await query;
      
      if (error) {
        monitoring.error('[useTotalCount] Error', { error });
        return 0;
      }
      
      return count || 0;
    },
    staleTime: 2 * 60 * 1000,
  });
};

export const usePropertiesInfinite = (filters?: PropertyFilters) => {
  const { data: totalCount } = useTotalCount(filters);
  
  const infiniteQuery = useInfiniteQuery({
    queryKey: ['properties-infinite', filters],
    queryFn: async ({ pageParam = 0 }) => {
      console.log('🔍 [List] Fetching properties with filters:', filters);

      let query = supabase
        .from('properties')
        .select('*');

      // ✅ SIEMPRE filtrar por activas
      query = query.eq('status', 'activa');

      // ✅ Solo aplicar filtros si tienen valor real
      if (filters?.estado && filters.estado.trim() !== '') {
        query = query.eq('state', filters.estado);
      }

      if (filters?.municipio && filters.municipio.trim() !== '') {
        query = query.eq('municipality', filters.municipio);
      }

      if (filters?.tipo && filters.tipo.trim() !== '') {
        query = query.eq('type', filters.tipo as any);
      }

      if (filters?.listingType && filters.listingType.trim() !== '') {
        query = query.eq('listing_type', filters.listingType);
      }

      const minPrice = Number(filters?.precioMin);
      if (!isNaN(minPrice) && minPrice > 0) {
        query = query.gte('price', minPrice);
      }

      const maxPrice = Number(filters?.precioMax);
      if (!isNaN(maxPrice) && maxPrice > 0) {
        query = query.lte('price', maxPrice);
      }

      const beds = Number(filters?.recamaras);
      if (!isNaN(beds) && beds > 0) {
        query = query.gte('bedrooms', beds);
      }

      const baths = Number(filters?.banos);
      if (!isNaN(baths) && baths > 0) {
        query = query.gte('bathrooms', baths);
      }

      // Ordenamiento
      query = query.order('created_at', { ascending: false });

      // Paginación offset-based
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);
      
      const { data: properties, error } = await query;
      
      if (error) {
        monitoring.error('[usePropertiesInfinite] Error', { hook: 'usePropertiesInfinite', error });
        throw error;
      }

      if (!properties || properties.length === 0) {
        return { properties: [], nextPage: null };
      }

      // ✅ Batch load de imágenes
      const propertyIds = properties.map((p) => p.id);
      const { data: imagesData } = await supabase
        .from('images')
        .select('property_id, url, position')
        .in('property_id', propertyIds)
        .order('position');

      interface ImageRow {
        property_id: string;
        url: string;
        position: number;
      }

      const imagesMap = new Map<string, Array<{ url: string; position: number }>>();
      (imagesData as ImageRow[] || []).forEach((img) => {
        if (!imagesMap.has(img.property_id)) {
          imagesMap.set(img.property_id, []);
        }
        imagesMap.get(img.property_id)!.push({ url: img.url, position: img.position });
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
      const enrichedProperties: PropertySummary[] = properties.map((property) => ({
        id: property.id,
        title: property.title,
        price: property.price,
        currency: property.currency || 'MXN',
        type: property.type === 'local_comercial' ? 'local' : property.type,
        listing_type: property.listing_type as 'venta' | 'renta',
        for_sale: property.for_sale ?? true,
        for_rent: property.for_rent ?? false,
        sale_price: property.sale_price,
        rent_price: property.rent_price,
        address: property.address,
        colonia: property.colonia,
        municipality: property.municipality,
        state: property.state,
        lat: property.lat,
        lng: property.lng,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        parking: property.parking,
        sqft: property.sqft,
        agent_id: property.agent_id,
        created_at: property.created_at,
        images: imagesMap.get(property.id) || [],
        is_featured: featuredSet.has(property.id),
      }));

      const hasMore = properties.length === PAGE_SIZE;

      return {
        properties: enrichedProperties,
        nextPage: hasMore ? pageParam + 1 : null,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  
  return {
    ...infiniteQuery,
    totalCount: totalCount || 0,
  };
};
