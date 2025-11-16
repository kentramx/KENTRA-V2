/**
 * ✅ Hook OPTIMIZADO para viewport con:
 * - Límites inteligentes según zoom
 * - Cache de 1 minuto
 * - Batch loading de imágenes
 * - Debounce automático vía staleTime
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { MapProperty, PropertyCluster, PropertyFilters } from '@/types/property';
import { monitoring } from '@/lib/monitoring';

export interface ViewportBounds {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  zoom: number;
}

// ✅ OPTIMIZACIÓN: Límites inteligentes según zoom
const getMaxPropertiesForZoom = (zoom: number): number => {
  if (zoom >= 16) return 500;
  if (zoom >= 14) return 300;
  if (zoom >= 12) return 150;
  return 100;
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
          monitoring.error('[usePropertiesViewport] Error', { hook: 'usePropertiesViewport', error });
          throw error;
        }

        // ✅ OPTIMIZACIÓN: Aplicar límite y batch load
        const limitedProperties = (data || []).slice(0, maxProperties);
        
        if (limitedProperties.length === 0) {
          return { clusters: [], properties: [] };
        }

        // ✅ Batch loading de imágenes
        const propertyIds = (limitedProperties as any[]).map((p) => p.id);
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
          .select('property_id')
          .in('property_id', propertyIds)
          .eq('status', 'active')
          .gte('end_date', new Date().toISOString());

        const featuredSet = new Set(featuredData?.map((f) => f.property_id) || []);

        // Normalizar a MapProperty
        const enrichedProperties: MapProperty[] = (limitedProperties as any[]).map((prop) => ({
          id: prop.id,
          title: prop.title,
          price: prop.price,
          currency: prop.currency || 'MXN',
          lat: prop.lat === null || prop.lat === undefined ? null : Number(prop.lat),
          lng: prop.lng === null || prop.lng === undefined ? null : Number(prop.lng),
          type: prop.type,
          listing_type: prop.listing_type,
          bedrooms: prop.bedrooms,
          bathrooms: prop.bathrooms,
          parking: prop.parking,
          sqft: prop.sqft,
          address: prop.address,
          state: prop.state,
          municipality: prop.municipality,
          agent_id: prop.agent_id,
          status: prop.status,
          created_at: prop.created_at,
          images: imagesMap.get(prop.id) || [],
          is_featured: featuredSet.has(prop.id),
        }));

      return { 
        clusters: [] as PropertyCluster[], 
        properties: enrichedProperties
      };
      }

      // ✅ Si zoom bajo (<14), cargar clusters
      const { data, error } = await supabase.rpc('get_property_clusters', {
        min_lng: bounds.minLng,
        min_lat: bounds.minLat,
        max_lng: bounds.maxLng,
        max_lat: bounds.maxLat,
        zoom_level: bounds.zoom,
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
        monitoring.error('[usePropertiesViewport] Cluster error', { hook: 'usePropertiesViewport', error });
        throw error;
      }

      const clusters = (data || []) as PropertyCluster[];
      return { clusters, properties: [] };
    },
    enabled: !!bounds,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};
