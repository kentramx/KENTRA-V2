import { useInfiniteQuery } from '@tanstack/react-query';
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
  status?: string[];
}

const PAGE_SIZE = 50; // Cargar 50 propiedades a la vez

export const usePropertiesInfinite = (filters?: PropertyFilters) => {
  return useInfiniteQuery({
    queryKey: ['properties-infinite', filters],
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from('properties')
        .select(`
          id, title, price, bedrooms, bathrooms, parking, 
          lat, lng, address, state, municipality, type, listing_type,
          created_at, sqft, agent_id, status, currency,
          for_sale, for_rent, sale_price, rent_price,
          images (url, position),
          featured_properties!left (
            id,
            status,
            end_date
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .order('position', { foreignTable: 'images', ascending: true });

      // Aplicar filtros
      if (filters?.status && filters.status.length > 0) {
        query = query.in('status', filters.status as any);
      } else {
        query = query.eq('status', 'activa');
      }
      
      if (filters?.estado) query = query.eq('state', filters.estado);
      if (filters?.municipio) query = query.eq('municipality', filters.municipio);
      if (filters?.tipo) query = query.eq('type', filters.tipo as any);
      
      if (filters?.listingType === 'venta') {
        query = query.eq('for_sale', true);
      } else if (filters?.listingType === 'renta') {
        query = query.eq('for_rent', true);
      }
      
      if (filters?.precioMin) query = query.gte('price', filters.precioMin);
      if (filters?.precioMax) query = query.lte('price', filters.precioMax);
      if (filters?.recamaras) query = query.gte('bedrooms', parseInt(filters.recamaras));
      if (filters?.banos) query = query.gte('bathrooms', parseInt(filters.banos));

      // Paginación
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      
      if (error) throw error;

      // Normalizar datos
      const properties = data?.map(property => {
        const featured = Array.isArray(property.featured_properties) 
          ? property.featured_properties[0] 
          : property.featured_properties;
        
        const isFeatured = featured 
          && featured.status === 'active' 
          && new Date(featured.end_date) > new Date();

        return {
          ...property,
          type: property.type === 'local_comercial' ? 'local' : property.type,
          images: (property.images || []).sort((a: any, b: any) => a.position - b.position),
          is_featured: isFeatured,
          featured_properties: undefined,
        };
      }) || [];

      return {
        properties,
        nextPage: properties.length === PAGE_SIZE ? pageParam + 1 : undefined,
        totalCount: count || 0,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
};
