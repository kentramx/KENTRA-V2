/**
 * Tipos para el sistema de mapas premium
 * KENTRA MAP STACK - OFICIAL
 */

// Bounds del mapa (mantenido para compatibilidad con property.ts)
export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// Viewport del mapa
export interface MapViewport {
  bounds: MapBounds;
  zoom: number;
  center: { lat: number; lng: number };
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
  colonia?: string;
}

// Propiedad individual (para markers Y lista)
export interface PropertyMarker {
  id: string;
  lat: number;
  lng: number;
  price: number;
  currency: 'MXN' | 'USD';
  title: string;
  listing_type: 'venta' | 'renta';
  type: string;
  // Campos para la lista
  address: string;
  colonia: string | null;
  municipality: string;
  state: string;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  sqft: number | null;
  for_sale: boolean;
  for_rent: boolean;
  sale_price: number | null;
  rent_price: number | null;
  images: { url: string; position?: number }[];
  agent_id: string;
  is_featured: boolean;
  created_at: string;
  image_url?: string;
}

// Cluster de propiedades
export interface PropertyCluster {
  id: string;
  lat: number;
  lng: number;
  count: number;
  avg_price?: number;
  min_price?: number;
  max_price?: number;
  expansion_zoom: number;
}

// Respuesta del hook useMapData
export interface MapDataResponse {
  properties: PropertyMarker[];
  clusters: PropertyCluster[];
  total_in_viewport: number;
  is_clustered: boolean; // true = modo cluster, false = markers individuales
}

// Estado visual del marker
export type MarkerState = 'default' | 'hover' | 'selected' | 'visited';
