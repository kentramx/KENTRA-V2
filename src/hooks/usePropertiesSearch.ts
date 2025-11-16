import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SearchFilters {
  query: string;
  estado?: string;
  municipio?: string;
  tipo?: string;
  listingType?: string;
  precioMin?: number;
  precioMax?: number;
  limit?: number;
  offset?: number;
}

export const usePropertiesSearch = (filters: SearchFilters) => {
  return useQuery({
    queryKey: ['properties-search', filters],
    queryFn: async () => {
      // Si no hay query, no buscar
      if (!filters.query || filters.query.trim().length < 2) {
        return [];
      }

      // Usar la función de full-text search optimizada
      const { data, error } = await supabase.rpc('search_properties_fts', {
        search_query: filters.query,
        p_state: filters.estado || null,
        p_municipality: filters.municipio || null,
        p_type: filters.tipo || null,
        p_listing_type: filters.listingType || null,
        p_price_min: filters.precioMin || null,
        p_price_max: filters.precioMax || null,
        p_limit: filters.limit || 50,
        p_offset: filters.offset || 0,
      });

      if (error) {
        console.error('Error en búsqueda FTS:', error);
        throw error;
      }

      // Cargar imágenes para cada propiedad
      const propertyIds = data?.map((p: any) => p.id) || [];
      
      if (propertyIds.length === 0) return [];

      const { data: images, error: imagesError } = await supabase
        .from('images')
        .select('property_id, url, position')
        .in('property_id', propertyIds)
        .order('position', { ascending: true });

      if (imagesError) {
        console.error('Error cargando imágenes:', imagesError);
      }

      // Combinar propiedades con imágenes
      const propertiesWithImages = data?.map((property: any) => {
        const propertyImages = images?.filter(
          (img: any) => img.property_id === property.id
        ) || [];

        return {
          ...property,
          images: propertyImages,
          is_featured: false, // Las propiedades de búsqueda no necesitan featured por ahora
        };
      }) || [];

      return propertiesWithImages;
    },
    enabled: !!filters.query && filters.query.trim().length >= 2,
    staleTime: 30000, // 30 segundos
  });
};
