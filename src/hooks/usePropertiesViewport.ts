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

// ✅ OPTIMIZACIÓN FASE 1: Límites reducidos según zoom para mejor rendimiento
const getMaxPropertiesForZoom = (zoom: number): number => {
  if (zoom >= 16) return 200;  // Reducido de 500
  if (zoom >= 14) return 150;  // Reducido de 300
  if (zoom >= 12) return 100;  // Reducido de 150
  return 50;                   // Reducido de 100
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

      // ✅ FASE 1: Pasar límite al RPC para reducir transferencia de datos
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
        p_limit: maxProperties, // ✅ Nuevo parámetro de límite
      });

      if (error) {
        monitoring.error('[usePropertiesViewport] Error al cargar propiedades', { 
          hook: 'usePropertiesViewport', 
          error,
          bounds,
          filters,
        });
        throw error;
      }

      // ✅ FASE 3: Eliminar slice porque el límite ya se aplicó en el RPC
      if (!data || data.length === 0) {
        return { clusters: [], properties: [] };
      }

      // ✅ FASE 3: Lazy loading - solo cargar primera imagen por propiedad
      const propertyIds = (data as any[]).map((p) => p.id);
      const { data: imagesData } = await supabase
        .from('images')
        .select('property_id, url, position')
        .in('property_id', propertyIds)
        .eq('position', 0) // Solo primera imagen
        .order('position', { ascending: true });

      // ✅ FASE 3: Mapear solo primera imagen
      const imagesMap = new Map<string, Array<{ url: string; position: number }>>();
      (imagesData || []).forEach((img: any) => {
        imagesMap.set(img.property_id, [{ url: img.url, position: img.position }]);
      });

      // Cargar featured
      const { data: featuredData } = await supabase
        .from('featured_properties')
        .select('property_id')
        .in('property_id', propertyIds)
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString());

      const featuredSet = new Set(featuredData?.map((f) => f.property_id) || []);

      // ✅ FASE 4: Log de performance
      const enrichedProperties: MapProperty[] = (data as any[]).map((prop) => ({
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

      // ✅ FASE 4: Métricas de performance
      monitoring.debug('[usePropertiesViewport] Propiedades cargadas', {
        count: enrichedProperties.length,
        limit: maxProperties,
        zoom: bounds.zoom,
        bounds: { minLat: bounds.minLat, maxLat: bounds.maxLat, minLng: bounds.minLng, maxLng: bounds.maxLng },
      });

      return { 
        clusters: [],
        properties: enrichedProperties
      };

      /* 
      ==========================================
      FUTURO: Lógica de clusters basada en get_property_clusters
      ==========================================
      Por ahora no se usa porque SearchMap/HomeMap usan MarkerClusterer del frontend.
      Se puede reactivar cuando se implemente UI basada en clusters del backend.
      
      const { data: clusterData, error: clusterError } = await supabase.rpc('get_property_clusters', {
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

      if (clusterError) {
        monitoring.error('[usePropertiesViewport] Cluster error', { 
          hook: 'usePropertiesViewport', 
          error: clusterError 
        });
        throw clusterError;
      }

      const clusters = (clusterData || []) as PropertyCluster[];
      return { clusters, properties: [] };
      */
    },
    enabled: !!bounds,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};
