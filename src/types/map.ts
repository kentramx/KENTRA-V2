/**
 * Map Types - Kentra Enterprise Maps
 * Centralized types for the map search system
 */

// ============= VIEWPORT =============

export interface MapViewport {
  bounds: MapBounds;
  zoom: number;
  center: { lat: number; lng: number };
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// ============= FILTERS =============

export interface MapFilters {
  listing_type?: 'venta' | 'renta';
  property_type?: string;
  min_price?: number;
  max_price?: number;
  min_bedrooms?: number;
  min_bathrooms?: number;
}

// ============= DATA TYPES =============

export interface MapCluster {
  id: string;
  count: number;
  lat: number;
  lng: number;
  min_price: number;
  max_price: number;
}

export interface MapPropertyMarker {
  id: string;
  lat: number;
  lng: number;
  price: number;
  currency: string;
  title: string;
  type: string;
  listing_type: string;
  address: string;
  municipality: string;
  state: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  is_featured: boolean;
  image_url: string | null;
}

export interface ListProperty {
  id: string;
  title: string;
  price: number;
  currency: string;
  listing_type: string;
  type: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  address: string;
  municipality: string;
  state: string;
  image_url: string | null;
  is_featured: boolean;
}

// ============= MEXICO CONFIG =============

export const MEXICO_CONFIG = {
  bounds: {
    north: 32.72,
    south: 14.53,
    west: -118.4,
    east: -86.7
  },
  defaultCenter: { lat: 23.6345, lng: -102.5528 },
  defaultZoom: 6,
  minZoom: 4,
  maxZoom: 18,
  clusterThreshold: 12 // Zoom level - below shows clusters, at/above shows properties
} as const;

// Map zoom to clustering precision
export const ZOOM_TO_PRECISION: Record<number, number> = {
  4: 3,  // Country level
  5: 3,
  6: 3,
  7: 4,  // Region level
  8: 4,
  9: 5,  // State level
  10: 5,
  11: 6, // City level
  12: 6,
};

export function getClusterPrecision(zoom: number): number {
  if (zoom <= 6) return 3;
  if (zoom <= 8) return 4;
  if (zoom <= 10) return 5;
  return 6;
}

// ============= STYLE CONFIG =============

export const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

export const MEXICO_BOUNDS: [[number, number], [number, number]] = [
  [MEXICO_CONFIG.bounds.west, MEXICO_CONFIG.bounds.south],
  [MEXICO_CONFIG.bounds.east, MEXICO_CONFIG.bounds.north]
];
