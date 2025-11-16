import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PropertyStatus } from '@/types/property';

type ValidPropertyStatus = 'activa' | 'pausada' | 'pendiente_aprobacion' | 'rentada' | 'vendida';

export const useAgentProperties = (
  agentId: string | undefined, 
  statusFilter?: PropertyStatus[]
) => {
  return useQuery({
    queryKey: ['agent-properties', agentId, statusFilter],
    queryFn: async () => {
      if (!agentId) throw new Error('Agent ID is required');

      let query = supabase
        .from('properties')
        .select(`
          id, title, price, bedrooms, bathrooms, type, listing_type,
          status, created_at, expires_at, last_renewed_at, address,
          state, municipality, colonia, sqft, parking, description, video_url,
          ai_moderation_score, ai_moderation_status, agent_id, property_code,
          rejection_history, resubmission_count, currency, for_sale, for_rent,
          images (id, url, position)
        `)
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter.length > 0) {
        const validStatuses: ValidPropertyStatus[] = statusFilter.filter((s): s is ValidPropertyStatus => 
          ['activa', 'pausada', 'pendiente_aprobacion', 'rentada', 'vendida'].includes(s)
        );
        if (validStatuses.length > 0) {
          query = query.in('status', validStatuses);
        }
      }

      const { data, error } = await query;
      
      if (error) throw error;

      interface PropertyImage {
        id: string;
        url: string;
        position: number;
      }

      return data?.map(property => ({
        ...property,
        images: (property.images as PropertyImage[] || []).sort((a, b) => a.position - b.position)
      })) || [];
    },
    enabled: !!agentId,
    staleTime: 30 * 1000,
  });
};
