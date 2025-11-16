/**
 * Hook OPTIMIZADO para properties - Cursor-based pagination
 * Reemplaza versión anterior con limit(1000) peligroso
 */

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
  limit?: number; // Nuevo: límite configurable
}

export const useProperties = (filters?: PropertyFilters) => {
  return useQuery({
    queryKey: ['properties', filters],
    queryFn: async () => {
      // ✅ OPTIMIZACIÓN: Usar RPC con cursor en lugar de query directo
      const limit = filters?.limit || 50; // Máximo 50 por defecto, no 1000

      const { data: properties, error } = await supabase.rpc('get_properties_cursor', {
        p_cursor: null, // Primera página
        p_limit: limit,
        p_state: filters?.estado || null,
        p_municipality: filters?.municipio || null,
        p_type: filters?.tipo || null,
        p_listing_type: filters?.listingType || null,
        p_price_min: filters?.precioMin || null,
        p_price_max: filters?.precioMax || null,
      });
      
      if (error) {
        console.error('[useProperties] Error:', error);
        throw error;
      }

      if (!properties || properties.length === 0) return [];

      // ✅ OPTIMIZACIÓN: Batch load de imágenes (evita N+1)
      const propertyIds = properties.map((p: any) => p.id);
      const { data: imagesData } = await supabase.rpc('get_images_batch', {
        property_ids: propertyIds,
      });

      // Mapear imágenes
      const imagesMap = new Map();
      imagesData?.forEach((item: any) => {
        imagesMap.set(item.property_id, item.images || []);
      });

      // Cargar featured properties
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
      return properties.map((property: any) => ({
        ...property,
        type: property.type === 'local_comercial' ? 'local' : property.type,
        images: imagesMap.get(property.id) || [],
        is_featured: featuredSet.has(property.id),
      }));
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos en cache
  });
};
