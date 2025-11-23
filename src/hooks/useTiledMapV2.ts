/**
 * 🚀 V2 TILE-BASED ARCHITECTURE ultra-escalable tipo Zillow
 * - QueryKey estable con normalización de bounds (3 decimales ~111m)
 * - Prefetch de 8 tiles vecinos con debounce 500ms + clamp de bounds
 * - Hard cap visual real: properties[] vacío si >1000 elementos
 * - Instrumentación DEV completa
 * - Soporta 1M-10M+ propiedades sin lag
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { MapProperty, PropertyCluster, PropertyFilters, PropertyStatus } from '@/types/property';
import { monitoring } from '@/lib/monitoring';
import { useEffect } from 'react';

export interface ViewportBounds {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  zoom: number;
}

// 🔒 Límites de seguridad para escalabilidad (optimizado estilo Zillow)
export const MIN_ZOOM_FOR_TILES = 3;
export const MAX_PROPERTIES_PER_TILE = 1000;

// ✅ Normalización de bounds para key estable (3 decimales ~111m precisión)
const normalizeBoundsKey = (b: ViewportBounds): string => {
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return [r(b.minLng), r(b.minLat), r(b.maxLng), r(b.maxLat), b.zoom].join('|');
};

// ✅ Normalización de filtros para key estable
const normalizeFiltersKey = (f: PropertyFilters): string => {
  const clean = {
    estado: f.estado || '',
    municipio: f.municipio || '',
    colonia: f.colonia || '',
    tipo: f.tipo || '',
    listingType: f.listingType || 'venta',
    precioMin: f.precioMin || '',
    precioMax: f.precioMax || '',
    recamaras: f.recamaras || '',
    banos: f.banos || '',
  };
  return JSON.stringify(clean);
};

export const useTiledMapV2 = (
  bounds: ViewportBounds | null,
  filters?: PropertyFilters
) => {
  const queryClient = useQueryClient();

  // ✅ Prefetch de 8 tiles vecinos con debounce 500ms + clamp
  useEffect(() => {
    if (!bounds || bounds.zoom < MIN_ZOOM_FOR_TILES) return;

    const prefetchAdjacentTiles = async () => {
      const { minLng, minLat, maxLng, maxLat, zoom } = bounds;
      const lngSpan = maxLng - minLng;
      const latSpan = maxLat - minLat;

      const adjacentBounds = [
        { minLng, minLat: maxLat, maxLng, maxLat: maxLat + latSpan, zoom }, // N
        { minLng, minLat: minLat - latSpan, maxLng, maxLat: minLat, zoom }, // S
        { minLng: minLng - lngSpan, minLat, maxLng: minLng, maxLat, zoom }, // W
        { minLng: maxLng, minLat, maxLng: maxLng + lngSpan, maxLat, zoom }, // E
        { minLng: minLng - lngSpan, minLat: maxLat, maxLng: minLng, maxLat: maxLat + latSpan, zoom }, // NW
        { minLng: maxLng, minLat: maxLat, maxLng: maxLng + lngSpan, maxLat: maxLat + latSpan, zoom }, // NE
        { minLng: minLng - lngSpan, minLat: minLat - latSpan, maxLng: minLng, maxLat: minLat, zoom }, // SW
        { minLng: maxLng, minLat: minLat - latSpan, maxLng: maxLng + lngSpan, maxLat: minLat, zoom }, // SE
      ];

      adjacentBounds.forEach((adj) => {
        // ✅ CLAMP obligatorio para evitar bounds inválidos
        const clamped = {
          minLng: Math.max(-180, Math.min(180, adj.minLng)),
          maxLng: Math.max(-180, Math.min(180, adj.maxLng)),
          minLat: Math.max(-85, Math.min(85, adj.minLat)),
          maxLat: Math.max(-85, Math.min(85, adj.maxLat)),
          zoom: adj.zoom,
        };

        const adjBoundsKey = normalizeBoundsKey(clamped);
        const filtersKey = normalizeFiltersKey(filters || ({} as PropertyFilters));

        // 🔥 Construir objeto de filtros inline (igual que V1)
        const filtersJson: Record<string, any> = {};
        if (filters?.estado) filtersJson.state = filters.estado;
        if (filters?.municipio) filtersJson.municipality = filters.municipio;
        if (filters?.listingType) filtersJson.listingType = filters.listingType;
        if (filters?.tipo && typeof filters.tipo === 'string') {
          filtersJson.propertyType = filters.tipo;
        }
        if (filters?.precioMin) filtersJson.minPrice = filters.precioMin;
        if (filters?.precioMax) filtersJson.maxPrice = filters.precioMax;
        if (filters?.recamaras) filtersJson.minBedrooms = parseInt(filters.recamaras);
        if (filters?.banos) filtersJson.minBathrooms = parseInt(filters.banos);

        queryClient.prefetchQuery({
          queryKey: ['map-tiles-v2', adjBoundsKey, filtersKey],
          queryFn: async () => {
            const { data } = await supabase.rpc('get_map_tiles', {
              p_min_lng: clamped.minLng,
              p_min_lat: clamped.minLat,
              p_max_lng: clamped.maxLng,
              p_max_lat: clamped.maxLat,
              p_zoom: zoom,
              p_filters: filtersJson,
            });
            return data;
          },
          staleTime: 5 * 60 * 1000,
        });
      });
    };

    const timer = setTimeout(prefetchAdjacentTiles, 500); // Debounce 500ms
    return () => clearTimeout(timer);
  }, [bounds, filters, queryClient]);

  const boundsKey = bounds ? normalizeBoundsKey(bounds) : 'no-bounds';
  const filtersKey = normalizeFiltersKey(filters || ({} as PropertyFilters));

  return useQuery({
    queryKey: ['map-tiles-v2', boundsKey, filtersKey],
    enabled: !!bounds && bounds.zoom >= MIN_ZOOM_FOR_TILES,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      if (!bounds || bounds.zoom < MIN_ZOOM_FOR_TILES) {
        return { clusters: [], properties: [], hasTooManyResults: false };
      }

      const startTime = performance.now();

      // 🔥 Construir objeto de filtros inline (copiado de V1)
      const filtersJson: Record<string, any> = {};
      if (filters?.estado) filtersJson.state = filters.estado;
      if (filters?.municipio) filtersJson.municipality = filters.municipio;
      if (filters?.listingType) filtersJson.listingType = filters.listingType;
      if (filters?.tipo && typeof filters.tipo === 'string') {
        filtersJson.propertyType = filters.tipo;
      }
      if (filters?.precioMin) filtersJson.minPrice = filters.precioMin;
      if (filters?.precioMax) filtersJson.maxPrice = filters.precioMax;
      if (filters?.recamaras) filtersJson.minBedrooms = parseInt(filters.recamaras);
      if (filters?.banos) filtersJson.minBathrooms = parseInt(filters.banos);

      // 🎯 Llamar a función RPC
      const { data, error } = await supabase.rpc('get_map_tiles', {
        p_min_lng: bounds.minLng,
        p_min_lat: bounds.minLat,
        p_max_lng: bounds.maxLng,
        p_max_lat: bounds.maxLat,
        p_zoom: bounds.zoom,
        p_filters: filtersJson,
      });

      if (error) {
        monitoring.error('[useTiledMapV2] Error al cargar tiles', {
          hook: 'useTiledMapV2',
          error,
          bounds,
          filters: filtersJson,
        });
        throw error;
      }

      const loadTime = performance.now() - startTime;

      if (!data) {
        return { clusters: [], properties: [], hasTooManyResults: false };
      }

      // 🔄 Procesar respuesta (copiado de V1)
      const result = data as any;
      const clusters: PropertyCluster[] = [];
      const properties: MapProperty[] = [];

      if (result.properties && Array.isArray(result.properties)) {
        result.properties.forEach((prop: any) => {
          if (!prop.lat || !prop.lng) return;
          properties.push({
            id: prop.id,
            title: prop.title,
            price: prop.price,
            currency: 'MXN',
            lat: Number(prop.lat),
            lng: Number(prop.lng),
            type: prop.property_type,
            listing_type: prop.listing_type,
            bedrooms: prop.bedrooms,
            bathrooms: prop.bathrooms,
            parking: prop.parking,
            sqft: prop.sqft,
            municipality: prop.municipality,
            state: prop.state,
            address: `${prop.municipality}, ${prop.state}`,
            images: prop.image_url ? [{ url: prop.image_url, position: 0 }] : [],
            agent_id: prop.agent_id || '',
            status: 'activa' as PropertyStatus,
            is_featured: !!prop.is_featured,
            created_at: prop.created_at || '',
          });
        });
      } else if (result.clusters && Array.isArray(result.clusters)) {
        result.clusters.forEach((c: any) => {
          clusters.push({
            cluster_id: `cluster-${bounds.zoom}-${c.lat}-${c.lng}`,
            lat: Number(c.lat),
            lng: Number(c.lng),
            property_count: Number(c.count || 0),
            avg_price: c.avg_price,
            property_ids: [],
          });
        });
      }

      // ✅ Hard cap visual REAL: NO truncar, sino retornar properties vacío
      const hasTooManyResults = properties.length > MAX_PROPERTIES_PER_TILE;

      if (hasTooManyResults) {
        monitoring.warn('[useTiledMapV2] Tile saturado, retornando solo clusters', {
          zoom: bounds.zoom,
          total: properties.length,
          limit: MAX_PROPERTIES_PER_TILE,
        });

        // 📊 Instrumentación DEV
        if (process.env.NODE_ENV === 'development') {
          console.log('🗺️ [useTiledMapV2] Tile saturado:', {
            boundsKey,
            filtersKey,
            loadTimeMs: Math.round(loadTime),
            clustersCount: clusters.length,
            propertiesCount: properties.length,
            hasTooManyResults: true,
          });
        }

        return { clusters, properties: [], hasTooManyResults: true };
      }

      // 📊 Instrumentación DEV
      if (process.env.NODE_ENV === 'development') {
        console.log('🗺️ [useTiledMapV2] Tiles loaded:', {
          boundsKey,
          filtersKey,
          loadTimeMs: Math.round(loadTime),
          clustersCount: clusters.length,
          propertiesCount: properties.length,
          hasTooManyResults: false,
        });
      }

      return { clusters, properties, hasTooManyResults: false };
    },
  });
};
