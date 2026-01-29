import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PropertySummary } from '@/types/property';

interface UseHomePropertiesResult {
  featuredProperties: PropertySummary[];
  recentProperties: PropertySummary[];
  isLoading: boolean;
  error: Error | null;
}

interface PropertyRow {
  id: string;
  title: string;
  price: number;
  currency: string;
  listing_type: string;
  type: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  lot_size: number | null;
  address: string;
  colonia: string | null;
  municipality: string;
  state: string;
  lat: number | null;
  lng: number | null;
  is_featured: boolean;
  created_at: string;
  agent_id: string;
}

function mapToPropertySummary(p: PropertyRow): PropertySummary {
  return {
    id: p.id,
    title: p.title,
    price: p.price,
    currency: p.currency,
    listing_type: p.listing_type as PropertySummary['listing_type'],
    type: p.type as PropertySummary['type'],
    for_sale: p.listing_type === 'venta',
    for_rent: p.listing_type === 'renta',
    sale_price: p.listing_type === 'venta' ? p.price : null,
    rent_price: p.listing_type === 'renta' ? p.price : null,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    parking: null,
    sqft: p.sqft,
    address: p.address,
    colonia: p.colonia,
    municipality: p.municipality,
    state: p.state,
    lat: p.lat,
    lng: p.lng,
    images: [],
    agent_id: p.agent_id,
    is_featured: p.is_featured,
    created_at: p.created_at
  };
}

export function useHomeProperties(): UseHomePropertiesResult {
  const { data: featuredData, isLoading: isLoadingFeatured, error: featuredError } = useQuery({
    queryKey: ['home-featured-properties'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select(`
          id,
          title,
          price,
          currency,
          listing_type,
          type,
          bedrooms,
          bathrooms,
          sqft,
          lot_size,
          address,
          colonia,
          municipality,
          state,
          lat,
          lng,
          is_featured,
          created_at,
          agent_id
        `)
        .eq('status', 'activa')
        .eq('is_featured', true)
        .order('created_at', { ascending: false })
        .limit(12);

      if (error) throw error;
      
      return (data || []).map(p => mapToPropertySummary(p as PropertyRow));
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: recentData, isLoading: isLoadingRecent, error: recentError } = useQuery({
    queryKey: ['home-recent-properties'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select(`
          id,
          title,
          price,
          currency,
          listing_type,
          type,
          bedrooms,
          bathrooms,
          sqft,
          lot_size,
          address,
          colonia,
          municipality,
          state,
          lat,
          lng,
          is_featured,
          created_at,
          agent_id
        `)
        .eq('status', 'activa')
        .order('created_at', { ascending: false })
        .limit(12);

      if (error) throw error;
      
      return (data || []).map(p => mapToPropertySummary(p as PropertyRow));
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    featuredProperties: featuredData || [],
    recentProperties: recentData || [],
    isLoading: isLoadingFeatured || isLoadingRecent,
    error: featuredError || recentError,
  };
}
