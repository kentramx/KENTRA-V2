/**
 * Tipos para mapas y filtros geoespaciales
 * Usados por hooks de búsqueda y componentes de mapa
 */

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MapViewport {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  zoom: number;
}

export interface MapFilters {
  listing_type?: 'venta' | 'renta' | null;
  property_type?: string | null;
  min_price?: number | null;
  max_price?: number | null;
  min_bedrooms?: number | null;
  state?: string | null;
  municipality?: string | null;
}
