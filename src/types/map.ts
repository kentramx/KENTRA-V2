/**
 * Tipos centralizados para el sistema de mapas
 */

// Viewport del mapa
export interface MapViewport {
  bounds: MapBounds;
  zoom: number;
  center: { lat: number; lng: number };
}

export interface MapBounds {
  north: number;  // maxLat
  south: number;  // minLat
  east: number;   // maxLng
  west: number;   // minLng
}

// Marcador de propiedad individual
export interface PropertyMarker {
  id: string;
  lat: number;
  lng: number;
  price: number;
  currency: 'MXN' | 'USD';
  title: string;
  listing_type: 'venta' | 'renta';
  type: string; // casa, departamento, etc.
  bedrooms?: number;
  bathrooms?: number;
  image_url?: string;
}

// Cluster de propiedades (del servidor)
export interface PropertyCluster {
  id: string;
  lat: number;
  lng: number;
  count: number;
  avg_price: number;
  // Zoom al que expandir para ver propiedades individuales
  expansion_zoom: number;
}

// Respuesta del servidor
export interface MapDataResponse {
  properties: PropertyMarker[];
  clusters: PropertyCluster[];
  total_in_viewport: number;
  truncated: boolean; // true si hay más de maxMarkers
}

// Filtros de búsqueda
export interface MapFilters {
  listing_type?: 'venta' | 'renta';
  property_type?: string;
  min_price?: number;
  max_price?: number;
  min_bedrooms?: number;
  min_bathrooms?: number;
  state?: string;
  municipality?: string;
}

// Estado del mapa
export type MapLoadingState = 'idle' | 'loading' | 'success' | 'error';

// Elemento seleccionado/hover
export interface SelectedMapItem {
  type: 'property' | 'cluster';
  id: string;
}
