/**
 * Tipos compartidos para propiedades
 * Archivo centralizado para evitar duplicación de interfaces
 */

export interface Property {
  id: string;
  title: string;
  price: number;
  currency?: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  parking?: number | null;
  lat?: number | null;
  lng?: number | null;
  address: string;
  colonia?: string;
  state: string;
  municipality: string;
  type: string;
  listing_type: string;
  for_sale?: boolean;
  for_rent?: boolean;
  sale_price?: number | null;
  rent_price?: number | null;
  images?: { url: string; position: number }[];
  created_at?: string | null;
  updated_at?: string | null;
  sqft?: number | null;
  lot_size?: number | null;
  agent_id: string;
  agency_id?: string | null;
  is_featured?: boolean;
  status?: string;
  description?: string | null;
  video_url?: string | null;
  amenities?: any;
}

export interface PropertyFilters {
  estado?: string;
  municipio?: string;
  tipo?: string;
  listingType?: string;
  precioMin?: number;
  precioMax?: number;
  recamaras?: string;
  banos?: string;
  status?: string[];
}

export interface PropertyCluster {
  cluster_id: string;
  lat: number;
  lng: number;
  property_count: number;
  avg_price: number;
  property_ids: string[];
}
