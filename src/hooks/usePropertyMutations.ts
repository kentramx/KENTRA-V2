import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Property } from '@/types/property';
import type { Database } from '@/integrations/supabase/types';
import { monitoring } from '@/lib/monitoring';

type PropertyInsert = Database['public']['Tables']['properties']['Insert'];
type PropertyUpdate = Database['public']['Tables']['properties']['Update'];

export const useCreateProperty = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (propertyData: PropertyInsert) => {
      const { data, error } = await supabase
        .from('properties')
        .insert(propertyData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['agent-properties', data.agent_id] });
      
      toast({
        title: '✅ Propiedad creada',
        description: 'Tu propiedad ha sido enviada para moderación',
      });
    },
    onError: (error) => {
      monitoring.error('Error creating property', {
        hook: 'useCreateProperty',
        error,
      });
      monitoring.captureException(error as Error, {
        hook: 'useCreateProperty',
      });
      toast({
        title: 'Error',
        description: 'No se pudo crear la propiedad',
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateProperty = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: PropertyUpdate }) => {
      const { data, error } = await supabase
        .from('properties')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['property', data.id] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['agent-properties', data.agent_id] });
      
      toast({
        title: '✅ Propiedad actualizada',
        description: 'Los cambios han sido guardados',
      });
    },
    onError: (error) => {
      monitoring.error('Error updating property', {
        hook: 'useUpdateProperty',
        error,
      });
      monitoring.captureException(error as Error, {
        hook: 'useUpdateProperty',
      });
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la propiedad',
        variant: 'destructive',
      });
    },
  });
};

export const useDeleteProperty = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (propertyId: string) => {
      // Soft delete: set deleted_at instead of hard delete
      // This preserves data for audit trails and potential restoration
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('properties')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id || null,
          status: 'eliminada' as const,
        })
        .eq('id', propertyId);

      if (error) throw error;
      return propertyId;
    },
    onSuccess: (propertyId) => {
      queryClient.removeQueries({ queryKey: ['property', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['agent-properties'] });

      toast({
        title: '🗑️ Propiedad eliminada',
        description: 'La propiedad ha sido archivada',
      });
    },
    onError: (error) => {
      monitoring.error('Error deleting property', {
        hook: 'useDeleteProperty',
        error,
      });
      monitoring.captureException(error as Error, {
        hook: 'useDeleteProperty',
      });
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la propiedad',
        variant: 'destructive',
      });
    },
  });
};
