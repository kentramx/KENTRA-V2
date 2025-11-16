import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Property, PropertyAgent } from '@/types/property';

interface PropertyWithAgent extends Property {
  agent: PropertyAgent;
}

export const useProperty = (propertyId: string | undefined) => {
  return useQuery<PropertyWithAgent>({
    queryKey: ['property', propertyId],
    queryFn: async () => {
      if (!propertyId) throw new Error('Property ID is required');

      const { data, error } = await supabase
        .from('properties')
        .select(`
          *,
          images (url, position),
          agent:profiles!agent_id (
            id, name, phone, whatsapp_number, 
            whatsapp_enabled, is_verified, avatar_url
          )
        `)
        .eq('id', propertyId)
        .single();

      if (error) throw error;

      // Check if property is featured
      const { data: featuredData } = await supabase
        .from('featured_properties')
        .select('id')
        .eq('property_id', propertyId)
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString())
        .maybeSingle();

      return {
        ...data,
        images: (data.images || []).sort((a: any, b: any) => a.position - b.position),
        is_featured: !!featuredData,
      } as PropertyWithAgent;
    },
    enabled: !!propertyId,
    staleTime: 10 * 60 * 1000,
  });
};
