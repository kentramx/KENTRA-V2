import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useMunicipalityStats = (state?: string, municipality?: string) => {
  return useQuery({
    queryKey: ['municipality-stats', state, municipality],
    queryFn: async () => {
      if (!state || !municipality) return null;

      const { data, error } = await supabase.rpc('get_municipality_stats', {
        p_state: state,
        p_municipality: municipality,
      });

      if (error) {
        console.error('Error cargando estadísticas de municipio:', error);
        throw error;
      }

      return data?.[0] || null;
    },
    enabled: !!state && !!municipality,
    staleTime: 60 * 60 * 1000, // 1 hora (las materialized views se refrescan cada hora)
  });
};

export const useStateStats = (state?: string) => {
  return useQuery({
    queryKey: ['state-stats', state],
    queryFn: async () => {
      if (!state) return null;

      const { data, error } = await supabase.rpc('get_state_stats', {
        p_state: state,
      });

      if (error) {
        console.error('Error cargando estadísticas de estado:', error);
        throw error;
      }

      return data?.[0] || null;
    },
    enabled: !!state,
    staleTime: 60 * 60 * 1000, // 1 hora
  });
};
