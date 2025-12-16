/**
 * Hook centralizado para gestionar favoritos del usuario
 * - Fetch inicial de favoritos
 * - Toggle optimista (actualiza UI antes de confirmar)
 * - Sincronización con Supabase
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useTracking } from '@/hooks/useTracking';

interface UseFavoritesReturn {
  favorites: Set<string>;
  isLoading: boolean;
  isFavorite: (propertyId: string) => boolean;
  toggleFavorite: (propertyId: string, propertyTitle?: string) => Promise<void>;
  favoritesCount: number;
}

export function useFavorites(): UseFavoritesReturn {
  const { user } = useAuth();
  const { toast } = useToast();
  const { trackGA4Event } = useTracking();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Fetch favoritos al montar o cuando cambia el usuario
  useEffect(() => {
    if (!user) {
      setFavoriteIds(new Set());
      return;
    }

    const fetchFavorites = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('favorites')
          .select('property_id')
          .eq('user_id', user.id);

        if (error) throw error;

        const ids = new Set(data?.map(f => f.property_id) || []);
        setFavoriteIds(ids);
      } catch (error) {
        console.error('Error fetching favorites:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFavorites();
  }, [user]);

  // Verificar si una propiedad es favorita
  const isFavorite = useCallback((propertyId: string) => {
    return favoriteIds.has(propertyId);
  }, [favoriteIds]);

  // Toggle favorito con actualización optimista
  const toggleFavorite = useCallback(async (propertyId: string, propertyTitle?: string) => {
    if (!user) {
      toast({
        title: 'Inicia sesión',
        description: 'Necesitas iniciar sesión para guardar favoritos',
        variant: 'destructive',
      });
      return;
    }

    const wasAlreadyFavorite = favoriteIds.has(propertyId);

    // Actualización optimista
    setFavoriteIds(prev => {
      const newSet = new Set(prev);
      if (wasAlreadyFavorite) {
        newSet.delete(propertyId);
      } else {
        newSet.add(propertyId);
      }
      return newSet;
    });

    try {
      if (wasAlreadyFavorite) {
        // Eliminar de favoritos
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('property_id', propertyId)
          .eq('user_id', user.id);

        if (error) throw error;

        trackGA4Event('remove_from_wishlist', {
          item_id: propertyId,
          item_name: propertyTitle || 'Propiedad',
        });

        toast({
          title: 'Eliminado de favoritos',
          description: 'Propiedad removida de tu lista',
        });
      } else {
        // Agregar a favoritos
        const { error } = await supabase
          .from('favorites')
          .insert({
            property_id: propertyId,
            user_id: user.id,
          });

        if (error) throw error;

        trackGA4Event('add_to_wishlist', {
          item_id: propertyId,
          item_name: propertyTitle || 'Propiedad',
        });

        toast({
          title: 'Agregado a favoritos',
          description: 'Propiedad guardada en tu lista',
        });
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      
      // Revertir en caso de error
      setFavoriteIds(prev => {
        const newSet = new Set(prev);
        if (wasAlreadyFavorite) {
          newSet.add(propertyId);
        } else {
          newSet.delete(propertyId);
        }
        return newSet;
      });

      toast({
        title: 'Error',
        description: 'No se pudo actualizar favoritos',
        variant: 'destructive',
      });
    }
  }, [user, favoriteIds, toast, trackGA4Event]);

  const favoritesCount = useMemo(() => favoriteIds.size, [favoriteIds]);

  return {
    favorites: favoriteIds,
    isLoading,
    isFavorite,
    toggleFavorite,
    favoritesCount,
  };
}
