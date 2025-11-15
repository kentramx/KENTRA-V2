import { useQuery } from '@tanstack/react-query';
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

export const useProperties = (filters?: PropertyFilters) => {
  return useQuery({
    queryKey: ['properties', filters],
    queryFn: async () => {
      let query = supabase
        .from('properties')
        .select(`
          id, title, price, bedrooms, bathrooms, parking, 
          lat, lng, address, state, municipality, type, listing_type,
          created_at, sqft, agent_id, status,
          images (url, position),
          featured_properties!left (
            id,
            status,
            end_date
          )
        `)
        .order('position', { foreignTable: 'images', ascending: true });

      // Aplicar filtros dinámicamente
      if (filters?.status && filters.status.length > 0) {
        query = query.in('status', filters.status as any);
      } else {
        query = query.eq('status', 'activa');
      }
      
      if (filters?.estado) query = query.eq('state', filters.estado);
      if (filters?.municipio) query = query.eq('municipality', filters.municipio);
      if (filters?.tipo) query = query.eq('type', filters.tipo as any);
      
      // Nuevo sistema: filtrar por for_sale o for_rent
      if (filters?.listingType === 'venta') {
        query = query.eq('for_sale', true);
      } else if (filters?.listingType === 'renta') {
        query = query.eq('for_rent', true);
      }
      
      if (filters?.precioMin) query = query.gte('price', filters.precioMin);
      if (filters?.precioMax) query = query.lte('price', filters.precioMax);
      if (filters?.recamaras) query = query.gte('bedrooms', parseInt(filters.recamaras));
      if (filters?.banos) query = query.gte('bathrooms', parseInt(filters.banos));

      const { data, error } = await query.limit(1000);
      
      if (error) throw error;

      // Normalizar datos y calcular is_featured
      return data?.map(property => {
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
          // Remover featured_properties del objeto final
          featured_properties: undefined,
        };
      }) || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
};
