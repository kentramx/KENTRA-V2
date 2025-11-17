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

      // 🎯 Llamar a nueva función RPC get_map_tiles
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
        dataReceived: data ? data.length : 0,
      });

      if (!data || data.length === 0) {
        return { clusters: [], properties: [] };
      }

      // 🔄 Procesar resultados según estructura real de get_map_tiles
      const clusters: PropertyCluster[] = [];
      const properties: MapProperty[] = [];

      // La RPC retorna array de filas, cada fila con campo 'type'
      data.forEach((item: any) => {
        if (item.type === 'cluster') {
          clusters.push({
            cluster_id: item.id,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lng),
            property_count: item.count,
            avg_price: item.avg_price,
            property_ids: [],
          });
        } else if (item.type === 'property') {
          properties.push({
            id: item.id,
            title: item.title,
            price: item.price,
            currency: 'MXN',
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lng),
            type: item.property_type,
            listing_type: item.listing_type,
            bedrooms: item.bedrooms,
            bathrooms: item.bathrooms,
            parking: item.parking,
            sqft: item.sqft,
            municipality: item.municipality,
            state: item.state,
            address: `${item.municipality}, ${item.state}`,
            images: item.image_url ? [{ url: item.image_url, position: 0 }] : [],
            agent_id: item.agent_id || '',
            status: 'activa' as PropertyStatus,
            is_featured: item.is_featured || false,
            created_at: item.created_at || '',
          });
        }
      });

      monitoring.debug('[useTiledMap] Data processed', {
        zoom: bounds.zoom,
        clustersCount: clusters.length,
        propertiesCount: properties.length,
        totalItems: data.length,
        loadTimeMs: Math.round(loadTime),
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
