import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PropertyImage, PropertyType, ListingType } from '@/types/property';

export interface SimilarProperty {
  id: string;
  title: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  parking: number | null;
  address: string;
  state: string;
  municipality: string;
  type: PropertyType;
  listing_type: ListingType;
  agent_id: string;
  images: PropertyImage[];
}

export const useSimilarProperties = (
  propertyId: string | undefined,
  propertyType: string | undefined,
  propertyState: string | undefined,
  limit: number = 4
) => {
  return useQuery({
    queryKey: ['similar-properties', propertyId, propertyType, propertyState, limit],
    queryFn: async () => {
      if (!propertyId || !propertyType || !propertyState) return [];

      const { data, error } = await supabase
        .from('properties')
        .select(`
          id, title, price, bedrooms, bathrooms, sqft, parking,
          address, state, municipality, type, listing_type, agent_id,
          images (url, position)
        `)
        .eq('status', 'activa')
        .eq('type', propertyType as any)
        .eq('state', propertyState)
        .neq('id', propertyId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data?.map(property => ({
        ...property,
        images: (property.images || []).sort((a: PropertyImage, b: PropertyImage) => a.position - b.position)
      })) as SimilarProperty[] || [];
    },
    enabled: !!propertyId && !!propertyType && !!propertyState,
    staleTime: 10 * 60 * 1000,
  });
};
