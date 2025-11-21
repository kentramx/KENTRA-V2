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

      // ✅ Solo aplicar filtros si tienen valor real (usando ilike para case-insensitivity)
      if (filters?.estado && filters.estado.trim() !== '') {
        query = query.ilike('state', filters.estado);
      }

      if (filters?.municipio && filters.municipio.trim() !== '') {
        query = query.ilike('municipality', filters.municipio);
      }

      if (filters?.tipo && filters.tipo.trim() !== '') {
        query = query.ilike('type', filters.tipo);
      }

      if (filters?.listingType && filters.listingType.trim() !== '') {
        query = query.ilike('listing_type', filters.listingType);
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
      
      const { data, error } = await query;
      
      if (error) {
        console.error('❌ [List] Error fetching properties:', error);
        monitoring.error('[usePropertiesInfinite] Error', { hook: 'usePropertiesInfinite', error });
        throw error;
      }

      if (!data || data.length === 0) {
        return { properties: [], nextPage: null };
      }

      // ✅ MAPEO CRÍTICO: DB (snake_case) -> Frontend (camelCase/PropertySummary)
      const mappedProperties: PropertySummary[] = data.map((p: any) => {
        // Extraer primera imagen si existe
        const firstImage = p.images?.[0] || null;
        
        return {
          id: p.id,
          title: p.title,
          price: p.price,
          currency: p.currency || 'MXN',
          type: p.type === 'local_comercial' ? 'local' : p.type,
          listing_type: p.listing_type as 'venta' | 'renta',
          for_sale: p.for_sale ?? true,
          for_rent: p.for_rent ?? false,
          sale_price: p.sale_price,
          rent_price: p.rent_price,
          address: p.address || `${p.municipality}, ${p.state}`,
          colonia: p.colonia,
          municipality: p.municipality,
          state: p.state,
          lat: p.lat ? Number(p.lat) : null,
          lng: p.lng ? Number(p.lng) : null,
          bedrooms: p.bedrooms,
          bathrooms: p.bathrooms,
          parking: p.parking,
          sqft: p.sqft,
          agent_id: p.agent_id,
          created_at: p.created_at,
          images: [],  // Se cargarán en batch después
          is_featured: false,  // Se actualizará después
        };
      });

      // ✅ Batch load de imágenes
      const propertyIds = mappedProperties.map((p) => p.id);
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

      // Enriquecer con imágenes y featured
      mappedProperties.forEach((property) => {
        property.images = imagesMap.get(property.id) || [];
        property.is_featured = featuredSet.has(property.id);
      });

      console.log(`✅ [List] Fetched ${mappedProperties.length} properties`);

      const hasMore = data.length === PAGE_SIZE;

      return {
        properties: mappedProperties,
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
