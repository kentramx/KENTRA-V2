/**
 * useMapSearch - FUENTE ÚNICA DE VERDAD para búsqueda de propiedades
 * 
 * Este hook unifica la lógica de datos para lista y mapa.
 * Internamente usa useTiledMap (get_map_tiles RPC) como única fuente.
 * 
 * @example
 * const { properties, clusters, isLoading } = useMapSearch({
 *   filters,
 *   viewportBounds,
 * });
 */

import { useMemo } from 'react';
import {
  useTiledMap,
  MIN_ZOOM_FOR_TILES,
  MAX_PROPERTIES_PER_TILE,
  CLUSTER_ZOOM_THRESHOLD,
  type TileDataResult,
} from './useTiledMap';
import type { ViewportBounds } from './useTiledMap';
import type { PropertyFilters, PropertySummary, MapProperty, PropertyCluster, PropertyImage } from '@/types/property';

// Re-exportar tipos y constantes para consumidores
export type { ViewportBounds };
export { MIN_ZOOM_FOR_TILES, MAX_PROPERTIES_PER_TILE, CLUSTER_ZOOM_THRESHOLD };

export interface UseMapSearchParams {
  filters: PropertyFilters;
  viewportBounds: ViewportBounds | null;
}

export interface UseMapSearchResult {
  /** Propiedades formateadas para la lista (PropertySummary[]) */
  properties: PropertySummary[];
  /** Propiedades raw del mapa (MapProperty[]) - para marcadores */
  mapProperties: MapProperty[];
  /** Clusters para el mapa */
  clusters: PropertyCluster[];
  /** Total de propiedades (properties + sum of cluster counts) */
  totalCount: number;
  /** Estados de carga */
  isLoading: boolean;
  isFetching: boolean;
  /** Error si existe */
  error: Error | null;
  /** Si hay demasiados resultados para mostrar individualmente */
  hasTooManyResults: boolean;
  /** Razón de debug cuando no hay datos */
  debugReason: string | null;
}

/**
 * Convierte MapProperty a PropertySummary para compatibilidad con componentes de lista
 */
function mapPropertyToSummary(mp: MapProperty): PropertySummary {
  return {
    id: mp.id,
    title: mp.title,
    price: mp.price,
    currency: mp.currency || 'MXN',
    type: mp.type,
    listing_type: mp.listing_type,
    for_sale: mp.listing_type === 'venta',
    for_rent: mp.listing_type === 'renta',
    sale_price: mp.listing_type === 'venta' ? mp.price : null,
    rent_price: mp.listing_type === 'renta' ? mp.price : null,
    bedrooms: mp.bedrooms ?? null,
    bathrooms: mp.bathrooms ?? null,
    parking: mp.parking ?? null,
    sqft: mp.sqft ?? null,
    address: mp.address || '',
    colonia: null,
    state: mp.state || '',
    municipality: mp.municipality || '',
    lat: mp.lat,
    lng: mp.lng,
    images: mp.images || [],
    agent_id: mp.agent_id || '',
    is_featured: mp.is_featured || false,
    created_at: mp.created_at || '',
  };
}

/**
 * Hook principal - fuente única de verdad para búsqueda
 */
export function useMapSearch({
  filters,
  viewportBounds
}: UseMapSearchParams): UseMapSearchResult {

  // ✅ Usar useTiledMap como única fuente de datos
  const {
    data: tileData,
    isLoading,
    isFetching,
    error,
  } = useTiledMap(viewportBounds, filters);

  // ✅ Extraer propiedades y clusters del resultado
  const mapProperties = useMemo(() => {
    return tileData?.properties ?? [];
  }, [tileData?.properties]);

  const clusters = useMemo(() => {
    return tileData?.clusters ?? [];
  }, [tileData?.clusters]);

  // ✅ Convertir MapProperty[] a PropertySummary[] para la lista
  const properties = useMemo(() => {
    return mapProperties.map(mapPropertyToSummary);
  }, [mapProperties]);

  // ✅ Usar totalCount del backend (más preciso que calcular en frontend)
  const totalCount = useMemo(() => {
    // Si tenemos el total del backend, usarlo
    if (tileData?.totalCount !== undefined) {
      return tileData.totalCount;
    }
    // Fallback: calcular en frontend
    const propertiesCount = properties.length;
    const clusteredCount = clusters.reduce((acc, c) => acc + (c.property_count || 0), 0);
    return propertiesCount + clusteredCount;
  }, [tileData?.totalCount, properties.length, clusters]);

  // ✅ Detectar si hay demasiados resultados (del backend o heurística)
  const hasTooManyResults = useMemo(() => {
    // Si el backend nos dice que hay más, confiar en él
    if (tileData?.hasMore) return true;
    // Fallback: si llegamos al límite de propiedades
    return mapProperties.length >= MAX_PROPERTIES_PER_TILE;
  }, [tileData?.hasMore, mapProperties.length]);

  // ✅ Razón de debug cuando no hay datos
  const debugReason = useMemo((): string | null => {
    if (isLoading) return null;
    
    if (!viewportBounds) {
      return 'Sin viewport bounds - esperando inicialización del mapa';
    }
    
    if (viewportBounds.zoom < MIN_ZOOM_FOR_TILES) {
      return `Zoom muy bajo (${viewportBounds.zoom} < ${MIN_ZOOM_FOR_TILES}) - acerca el mapa`;
    }
    
    if (!tileData) {
      return 'RPC devolvió null - posible error de conexión';
    }
    
    if (properties.length === 0 && clusters.length === 0) {
      return 'Sin propiedades en esta área con los filtros actuales';
    }
    
    return null;
  }, [isLoading, viewportBounds, tileData, properties.length, clusters.length]);

  return {
    properties,
    mapProperties,
    clusters,
    totalCount,
    isLoading,
    isFetching,
    error: error as Error | null,
    hasTooManyResults,
    debugReason,
  };
}
