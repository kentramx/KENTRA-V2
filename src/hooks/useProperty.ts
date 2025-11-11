import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useProperty = (propertyId: string | undefined) => {
  return useQuery({
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
            whatsapp_enabled, is_verified
          )
        `)
        .eq('id', propertyId)
        .single();

      if (error) throw error;

      return {
        ...data,
        images: (data.images || []).sort((a: any, b: any) => a.position - b.position)
      };
    },
    enabled: !!propertyId,
    staleTime: 10 * 60 * 1000, // 10 minutos
  });
};
