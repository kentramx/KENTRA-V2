/**
 * 🚀 TILE-BASED ARCHITECTURE para escalabilidad infinita
 * - Reemplaza usePropertiesViewport con arquitectura tipo Zillow/Google Maps
 * - Soporta desde 1K hasta 10M+ propiedades con rendimiento constante
 * - Clustering adaptativo según zoom level
 * - Cache de 5 minutos por tile
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { MapProperty, PropertyCluster, PropertyFilters, PropertyStatus } from '@/types/property';
import { monitoring } from '@/lib/monitoring';

export interface ViewportBounds {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  zoom: number;
}

export const useTiledMap = (
  bounds: ViewportBounds | null,
  filters?: PropertyFilters
) => {
  return useQuery({
    queryKey: ['map-tiles', bounds, filters],
    queryFn: async () => {
      if (!bounds) return { clusters: [], properties: [] };

      const startTime = performance.now();

      // Construir objeto de filtros en formato JSONB
      const filtersJson = {
        state: filters?.estado || null,
        municipality: filters?.municipio || null,
        listingType: filters?.listingType || null,
        propertyType: filters?.tipo || null,
        minPrice: filters?.precioMin || null,
        maxPrice: filters?.precioMax || null,
        minBedrooms: filters?.recamaras ? parseInt(filters.recamaras) : null,
        minBathrooms: filters?.banos ? parseInt(filters.banos) : null,
      };

      // 🎯 Llamar a función RPC simple
      const { data, error } = await supabase.rpc('get_map_tiles', {
        p_min_lng: bounds.minLng,
        p_min_lat: bounds.minLat,
        p_max_lng: bounds.maxLng,
        p_max_lat: bounds.maxLat,
        p_zoom: bounds.zoom,
        p_filters: filtersJson,
      });

      if (error) {
        monitoring.error('[useTiledMap] Error al cargar tiles', { 
          hook: 'useTiledMap', 
          error,
          bounds,
          filters: filtersJson,
        });
        throw error;
      }

      const loadTime = performance.now() - startTime;

      // 📊 Log de performance
      monitoring.debug('[useTiledMap] Tiles loaded', {
        zoom: bounds.zoom,
        loadTimeMs: Math.round(loadTime),
        dataReceived: data ? 'yes' : 'no',
      });

      if (!data) {
        return { clusters: [], properties: [] };
      }

      // 🔄 Procesar respuesta: data tiene clusters o properties directamente
      const result = data as any;
      const clusters: PropertyCluster[] = [];
      const properties: MapProperty[] = [];

      if (result.properties && Array.isArray(result.properties)) {
        result.properties.forEach((prop: any) => {
          if (!prop.lat || !prop.lng) return;
          properties.push({
            id: prop.id, title: prop.title, price: prop.price, currency: 'MXN',
            lat: Number(prop.lat), lng: Number(prop.lng),
            type: prop.property_type, listing_type: prop.listing_type,
            bedrooms: prop.bedrooms, bathrooms: prop.bathrooms,
            parking: prop.parking, sqft: prop.sqft,
            municipality: prop.municipality, state: prop.state,
            address: `${prop.municipality}, ${prop.state}`,
            images: prop.image_url ? [{ url: prop.image_url, position: 0 }] : [],
            agent_id: prop.agent_id || '', status: 'activa' as PropertyStatus,
            is_featured: !!prop.is_featured, created_at: prop.created_at || '',
          });
        });
      } else if (result.clusters && Array.isArray(result.clusters)) {
        result.clusters.forEach((c: any) => {
          clusters.push({
            cluster_id: `cluster-${bounds.zoom}-${c.lat}-${c.lng}`,
            lat: Number(c.lat), lng: Number(c.lng),
            property_count: Number(c.count || 0),
            avg_price: c.avg_price, property_ids: [],
          });
        });
      }

      monitoring.debug('[useTiledMap] Data processed', {
        zoom: bounds.zoom, clustersCount: clusters.length,
        propertiesCount: properties.length, loadTimeMs: Math.round(loadTime),
      });

      return { clusters, properties };
    },
    enabled: !!bounds, // Solo ejecutar si hay bounds
    staleTime: 5 * 60 * 1000,   // Cache de 5 minutos (más largo que viewport)
    gcTime: 30 * 60 * 1000,     // Mantener en cache 30 minutos
    retry: 1,
    refetchOnWindowFocus: false,
  });
};
