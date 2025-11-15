import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ViewportBounds {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  zoom: number;
}

interface PropertyFilters {
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

interface PropertyCluster {
  cluster_id: string;
  lat: number;
  lng: number;
  property_count: number;
  avg_price: number;
  property_ids: string[];
}

interface Property {
  id: string;
  title: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  lat: number;
  lng: number;
  address: string;
  state: string;
  municipality: string;
  type: string;
  listing_type: string;
  sqft: number | null;
  agent_id: string;
  status: string;
  created_at: string;
  is_featured: boolean;
  images: Array<{ url: string; position: number }>;
}

export const usePropertiesViewport = (
  bounds: ViewportBounds | null,
  filters?: PropertyFilters
) => {
  return useQuery({
    queryKey: ['properties-viewport', bounds, filters],
    queryFn: async () => {
      if (!bounds) return { clusters: [], properties: [] };

      const status = filters?.status?.[0] || 'activa';

      // Si zoom alto (>=14), cargar propiedades individuales
      if (bounds.zoom >= 14) {
        const { data, error } = await supabase.rpc('get_properties_in_viewport', {
          min_lng: bounds.minLng,
          min_lat: bounds.minLat,
          max_lng: bounds.maxLng,
          max_lat: bounds.maxLat,
          p_status: status,
          p_state: filters?.estado || null,
          p_municipality: filters?.municipio || null,
          p_type: filters?.tipo || null,
          p_listing_type: filters?.listingType || null,
          p_price_min: filters?.precioMin || null,
          p_price_max: filters?.precioMax || null,
          p_bedrooms: filters?.recamaras ? parseInt(filters.recamaras) : null,
          p_bathrooms: filters?.banos ? parseInt(filters.banos) : null,
        });

        if (error) {
          console.error('Error loading properties:', error);
          throw error;
        }

        return { 
          clusters: [] as PropertyCluster[], 
          properties: (data || []) as Property[]
        };
      }

      // Si zoom bajo (<14), cargar clusters
      const { data, error } = await supabase.rpc('get_property_clusters', {
        min_lng: bounds.minLng,
        min_lat: bounds.minLat,
        max_lng: bounds.maxLng,
        max_lat: bounds.maxLat,
        zoom_level: Math.round(bounds.zoom),
        p_status: status,
        p_state: filters?.estado || null,
        p_municipality: filters?.municipio || null,
        p_type: filters?.tipo || null,
        p_listing_type: filters?.listingType || null,
        p_price_min: filters?.precioMin || null,
        p_price_max: filters?.precioMax || null,
        p_bedrooms: filters?.recamaras ? parseInt(filters.recamaras) : null,
        p_bathrooms: filters?.banos ? parseInt(filters.banos) : null,
      });

      if (error) {
        console.error('Error loading clusters:', error);
        throw error;
      }

      return { 
        clusters: (data || []) as PropertyCluster[], 
        properties: [] as Property[]
      };
    },
    enabled: !!bounds,
    staleTime: 30000, // 30 segundos
    gcTime: 5 * 60 * 1000, // 5 minutos
  });
};
