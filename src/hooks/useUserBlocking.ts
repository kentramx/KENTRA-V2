import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { monitoring } from '@/lib/monitoring';

interface BlockedUser {
  blocked_id: string;
  blocked_at: string;
  reason: string | null;
}

interface BlockUserResult {
  success: boolean;
  message: string;
}

export const useBlockedUsers = () => {
  return useQuery({
    queryKey: ['blocked-users'],
    queryFn: async (): Promise<BlockedUser[]> => {
      const { data, error } = await supabase.rpc('get_blocked_users');

      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useIsUserBlocked = (otherUserId: string | null) => {
  return useQuery({
    queryKey: ['is-blocked', otherUserId],
    queryFn: async (): Promise<boolean> => {
      if (!otherUserId) return false;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase.rpc('is_user_blocked', {
        p_user_id: user.id,
        p_other_user_id: otherUserId,
      });

      if (error) {
        monitoring.error('Error checking if user is blocked', { error });
        return false;
      }

      return data || false;
    },
    enabled: !!otherUserId,
    staleTime: 1000 * 60, // 1 minute
  });
};

export const useBlockUser = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason?: string }): Promise<BlockUserResult> => {
      const { data, error } = await supabase.rpc('block_user', {
        p_user_id_to_block: userId,
        p_reason: reason || null,
      });

      if (error) throw error;

      const result = data?.[0];
      if (!result?.success) {
        throw new Error(result?.message || 'Failed to block user');
      }

      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
      queryClient.invalidateQueries({ queryKey: ['is-blocked', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });

      toast({
        title: 'Usuario bloqueado',
        description: 'Ya no recibirás mensajes de este usuario',
      });
    },
    onError: (error) => {
      monitoring.error('Error blocking user', { error });
      monitoring.captureException(error as Error, { hook: 'useBlockUser' });

      toast({
        title: 'Error',
        description: 'No se pudo bloquear al usuario',
        variant: 'destructive',
      });
    },
  });
};

export const useUnblockUser = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (userId: string): Promise<BlockUserResult> => {
      const { data, error } = await supabase.rpc('unblock_user', {
        p_user_id_to_unblock: userId,
      });

      if (error) throw error;

      const result = data?.[0];
      if (!result?.success) {
        throw new Error(result?.message || 'Failed to unblock user');
      }

      return result;
    },
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
      queryClient.invalidateQueries({ queryKey: ['is-blocked', userId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });

      toast({
        title: 'Usuario desbloqueado',
        description: 'Podrás recibir mensajes de este usuario nuevamente',
      });
    },
    onError: (error) => {
      monitoring.error('Error unblocking user', { error });
      monitoring.captureException(error as Error, { hook: 'useUnblockUser' });

      toast({
        title: 'Error',
        description: 'No se pudo desbloquear al usuario',
        variant: 'destructive',
      });
    },
  });
};
