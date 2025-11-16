/**
 * ✅ Hook OPTIMIZADO para viewport con:
 * - Límites inteligentes según zoom
 * - Cache de 1 minuto
 * - Batch loading de imágenes
 * - Debounce automático vía staleTime
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Property, PropertyFilters, PropertyCluster } from '@/types/property';

export interface ViewportBounds {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  zoom: number;
}

// ✅ OPTIMIZACIÓN: Límites inteligentes según zoom
const getMaxPropertiesForZoom = (zoom: number): number => {
  if (zoom >= 16) return 500; // Vista muy cercana
  if (zoom >= 14) return 300; // Vista de barrio
  if (zoom >= 12) return 150; // Vista de ciudad
  return 100; // Vista amplia
};

export const usePropertiesViewport = (
  bounds: ViewportBounds | null,
  filters?: PropertyFilters
) => {
  return useQuery({
    queryKey: ['properties-viewport', bounds, filters],
    queryFn: async () => {
      if (!bounds) return { clusters: [], properties: [] };

      const status = filters?.status?.[0] || 'activa';
      const maxProperties = getMaxPropertiesForZoom(bounds.zoom);

        // Forzamos carga de propiedades individuales siempre (cluster off)
        if (true) {
        const startTime = Date.now();
        
        const { data, error } = await supabase.rpc('get_properties_in_viewport', {
          min_lng: bounds.minLng,
          min_lat: bounds.minLat,
          max_lng: bounds.maxLng,
          max_lat: bounds.maxLat,
          p_status: status,
          p_state: filters?.estado || null,
          p_municipality: filters?.municipio || null,
          p_type: filters?.tipo || null,
          p_listing_type: filters?.listingType || null,
          p_price_min: filters?.precioMin || null,
          p_price_max: filters?.precioMax || null,
          p_bedrooms: filters?.recamaras ? parseInt(filters.recamaras) : null,
          p_bathrooms: filters?.banos ? parseInt(filters.banos) : null,
        });

        if (error) {
          console.error('[usePropertiesViewport] Error:', error);
          throw error;
        }

        // ✅ OPTIMIZACIÓN: Aplicar límite y batch load
        const limitedProperties = (data || []).slice(0, maxProperties);
        
        if (limitedProperties.length === 0) {
          return { clusters: [], properties: [] };
        }

        // ✅ Batch loading de imágenes
        const propertyIds = limitedProperties.map((p: any) => p.id);
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
          .select('property_id')
          .in('property_id', propertyIds)
          .eq('status', 'active')
          .gte('end_date', new Date().toISOString());

        const featuredSet = new Set(featuredData?.map((f: any) => f.property_id) || []);

        const enrichedProperties = limitedProperties.map((prop: any) => ({
          ...prop,
          lat: prop.lat === null || prop.lat === undefined ? null : Number(prop.lat),
          lng: prop.lng === null || prop.lng === undefined ? null : Number(prop.lng),
          images: imagesMap.get(prop.id) || [],
          is_featured: featuredSet.has(prop.id),
        }));

        return {
          clusters: [] as PropertyCluster[], 
          properties: enrichedProperties as Property[]
        };
      }

      // ✅ Si zoom bajo (<14), cargar clusters
      const { data, error } = await supabase.rpc('get_property_clusters', {
        min_lng: bounds.minLng,
        min_lat: bounds.minLat,
        max_lng: bounds.maxLng,
        max_lat: bounds.maxLat,
        zoom_level: Math.round(bounds.zoom),
        p_status: status,
        p_state: filters?.estado || null,
        p_municipality: filters?.municipio || null,
        p_type: filters?.tipo || null,
        p_listing_type: filters?.listingType || null,
        p_price_min: filters?.precioMin || null,
        p_price_max: filters?.precioMax || null,
        p_bedrooms: filters?.recamaras ? parseInt(filters.recamaras) : null,
        p_bathrooms: filters?.banos ? parseInt(filters.banos) : null,
      });

      if (error) {
        console.error('[usePropertiesViewport] Error clusters:', error);
        throw error;
      }

      return { 
        clusters: (data || []) as PropertyCluster[], 
        properties: [] as Property[]
      };
    },
    enabled: !!bounds,
    staleTime: 3 * 60 * 1000, // ✅ 3 minutos de cache para reducir recargas
    gcTime: 5 * 60 * 1000, // 5 minutos
    retry: (failureCount, error: any) => {
      // ✅ NO reintentar si es error SQL permanente (42xxx codes)
      if (error?.code?.startsWith('42') || error?.code?.startsWith('4')) {
        console.error('[usePropertiesViewport] Error permanente, no reintentar:', error);
        return false;
      }
      // Solo reintentar 1 vez para otros errores
      return failureCount < 1;
    },
    retryDelay: 500, // ✅ Esperar 0.5 segundos (más rápido)
    refetchOnWindowFocus: false, // ✅ No refrescar al cambiar de ventana
    refetchOnMount: false, // ✅ No refrescar si hay datos en cache
  });
};
