import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useAgentProperties = (agentId: string | undefined, statusFilter?: string[]) => {
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
          ai_moderation_score, ai_moderation_status, agent_id,
          rejection_history, resubmission_count,
          images (id, url, position)
        `)
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter.length > 0) {
        query = query.in('status', statusFilter as any);
      }

      const { data, error } = await query;
      
      if (error) throw error;

      return data?.map(property => ({
        ...property,
        images: (property.images || []).sort((a: any, b: any) => a.position - b.position)
      })) || [];
    },
    enabled: !!agentId,
    staleTime: 30 * 1000, // 30 segundos
  });
};
