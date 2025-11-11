import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
        images: (property.images || []).sort((a: any, b: any) => a.position - b.position)
      })) || [];
    },
    enabled: !!propertyId && !!propertyType && !!propertyState,
    staleTime: 10 * 60 * 1000,
  });
};
