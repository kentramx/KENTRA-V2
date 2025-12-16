import type { MapBounds } from '@/types/map';

/**
 * Tipo central unificado para Property
 * ✅ Fuente única de verdad para todas las propiedades del sistema
 */

// ============= TIPO PRINCIPAL =============

export interface Property {
  // Identificación
  id: string;
  property_code: string | null;

  // Información básica
  title: string;
  description: string | null;
  type: PropertyType;
  listing_type: ListingType;

  // Precio y moneda
  price: number;
  currency: string; // "MXN" | "USD"
  for_sale: boolean;
  for_rent: boolean;
  sale_price: number | null;
  rent_price: number | null;

  // Características físicas
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  sqft: number | null;
  lot_size: number | null;

  // Ubicación
  address: string;
  colonia: string | null;
  municipality: string;
  state: string;
  lat: number | null;
  lng: number | null;

  // Amenidades y medios
  amenities: Record<string, any> | null;
  images: PropertyImage[];
  video_url: string | null;

  // Relaciones con usuarios
  agent_id: string;
  agency_id: string | null;

  // Estado y moderación
  status: PropertyStatus;
  ai_moderation_status: AIModerationStatus | null;
  ai_moderation_score: number | null;
  ai_moderation_notes: string | null;
  ai_moderated_at: string | null;
  requires_manual_review: boolean | null;
  rejection_history: Record<string, any> | null;
  resubmission_count: number;

  // Featured y destacados
  is_featured: boolean;

  // Análisis de imágenes
  has_inappropriate_images: boolean | null;
  has_manipulated_images: boolean | null;
  images_analyzed_count: number | null;
  images_quality_avg: number | null;

  // Duplicados
  duplicate_warning: boolean | null;
  duplicate_warning_data: Record<string, any> | null;

  // Historial de precios
  price_history: Record<string, any> | null;

  // Fechas
  created_at: string;
  updated_at: string | null;
  expires_at: string | null;
  last_renewed_at: string | null;
}

// ============= TIPOS DERIVADOS =============

/**
 * Versión resumida para tarjetas y listados
 */
export interface PropertySummary {
  id: string;
  title: string;
  price: number;
  currency: string;
  type: PropertyType;
  listing_type: ListingType;
  for_sale: boolean;
  for_rent: boolean;
  sale_price: number | null;
  rent_price: number | null;
  address: string;
  colonia: string | null;
  municipality: string;
  state: string;
  lat: number | null;
  lng: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  sqft: number | null;
  images: PropertyImage[];
  agent_id: string;
  is_featured: boolean;
  created_at: string;
}

/**
 * Versión para mapas (solo coordenadas y datos básicos)
 */
export interface MapProperty {
  id: string;
  title: string;
  price: number;
  currency: string;
  lat: number;
  lng: number;
  type: PropertyType;
  listing_type: ListingType;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  sqft: number | null;
  address: string;
  state: string;
  municipality: string;
  images: PropertyImage[];
  agent_id: string;
  status: PropertyStatus;
  is_featured: boolean;
  created_at: string;
}

/**
 * Versión para clusters en el mapa
 */
export interface PropertyCluster {
  cluster_id: string;
  lat: number;
  lng: number;
  property_count: number;
  avg_price: number;
  property_ids: string[];
}

/**
 * Versión ligera para hover (sin coordenadas)
 */
export interface HoveredProperty {
  id: string;
  title: string;
  price: number;
  currency: string;
  lat?: number | null;
  lng?: number | null;
}

// ============= INTERFACES DE SOPORTE =============

export interface PropertyImage {
  id?: string;
  url: string;
  position: number;
}

export interface PropertyAgent {
  id: string;
  name: string;
  phone: string | null;
  whatsapp_number: string | null;
  whatsapp_enabled: boolean | null;
  is_verified: boolean | null;
  avatar_url: string | null;
}

export interface AgentStats {
  activeProperties: number;
  avgRating: string | null;
  totalReviews: number;
}

export interface PropertyPriceHistory {
  price: number;
  date: string;
  change_type: 'increase' | 'reduction' | 'initial';
}

export interface PropertyAmenity {
  category: string;
  items: string[];
}

// ============= ENUMS Y TIPOS =============

export type PropertyType =
  | 'casa'
  | 'departamento'
  | 'terreno'
  | 'oficina'
  | 'local'
  | 'bodega'
  | 'edificio'
  | 'rancho';

export type ListingType = 'venta' | 'renta';

export type PropertyStatus =
  | 'activa'
  | 'pendiente'
  | 'pendiente_aprobacion'
  | 'rechazada'
  | 'expirada'
  | 'vendida'
  | 'rentada'
  | 'pausada';

export type AIModerationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'needs_review';

// ============= FILTROS =============

// Re-exportar MapBounds desde map.ts para compatibilidad
export type { MapBounds };

// ViewportBounds es ahora MapViewport de map.ts
export interface ViewportBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  zoom: number;
}

export interface PropertyFilters {
  estado?: string;
  municipio?: string;
  colonia?: string;
  tipo?: string;
  listingType?: string;
  precioMin?: number;
  precioMax?: number;
  recamaras?: string;
  banos?: string;
  status?: string[];
  orden?: string;
  bounds?: ViewportBounds;
  lat?: number;
  lng?: number;
}
