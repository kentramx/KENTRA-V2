import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { monitoring } from '@/lib/monitoring';

interface ArchivedConversation {
  conversation_id: string;
  property_id: string;
  other_user_id: string;
  archived_at: string;
  last_message_at: string;
}

interface ArchiveResult {
  success: boolean;
  message: string;
}

export const useArchivedConversations = () => {
  return useQuery({
    queryKey: ['archived-conversations'],
    queryFn: async (): Promise<ArchivedConversation[]> => {
      const { data, error } = await supabase.rpc('get_archived_conversations');

      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useArchiveConversation = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (conversationId: string): Promise<ArchiveResult> => {
      const { data, error } = await supabase.rpc('archive_conversation', {
        p_conversation_id: conversationId,
      });

      if (error) throw error;

      const result = data?.[0];
      if (!result?.success) {
        throw new Error(result?.message || 'Failed to archive conversation');
      }

      return result;
    },
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['archived-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });

      toast({
        title: 'Conversación archivada',
        description: 'La conversación ha sido movida a archivados',
      });
    },
    onError: (error) => {
      monitoring.error('Error archiving conversation', { error });
      monitoring.captureException(error as Error, { hook: 'useArchiveConversation' });

      toast({
        title: 'Error',
        description: 'No se pudo archivar la conversación',
        variant: 'destructive',
      });
    },
  });
};

export const useUnarchiveConversation = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (conversationId: string): Promise<ArchiveResult> => {
      const { data, error } = await supabase.rpc('unarchive_conversation', {
        p_conversation_id: conversationId,
      });

      if (error) throw error;

      const result = data?.[0];
      if (!result?.success) {
        throw new Error(result?.message || 'Failed to unarchive conversation');
      }

      return result;
    },
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['archived-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });

      toast({
        title: 'Conversación restaurada',
        description: 'La conversación ha sido movida a activas',
      });
    },
    onError: (error) => {
      monitoring.error('Error unarchiving conversation', { error });
      monitoring.captureException(error as Error, { hook: 'useUnarchiveConversation' });

      toast({
        title: 'Error',
        description: 'No se pudo restaurar la conversación',
        variant: 'destructive',
      });
    },
  });
};
