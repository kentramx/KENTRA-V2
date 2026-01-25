import { useEffect, useCallback } from 'react';
import { useMapStore } from '@/stores/mapStore';
import { supabase } from '@/integrations/supabase/client';
import { useDebouncedCallback } from 'use-debounce';
import toast from 'react-hot-toast';

export function useListData() {
  const {
    viewport,
    filters,
    listPage,
    setListData,
    setIsListLoading,
    setListError,
    isListLoading,
    listProperties,
    listTotal,
    listPages,
    setListPage,
  } = useMapStore();

  const fetchListData = useCallback(async () => {
    if (!viewport) return;

    setIsListLoading(true);
    setListError(null);

    try {
      const { data, error } = await supabase.functions.invoke('search-properties', {
        body: {
          query: '',
          filters,
          bounds: viewport.bounds,
          page: listPage,
          limit: 20,
          sort: '-created_at',
        },
      });

      if (error) throw error;

      setListData({
        properties: data.properties || [],
        total: data.total || 0,
        page: data.page || 1,
        pages: data.pages || 0,
      });

    } catch (err: any) {
      console.error('[useListData] Error:', err);
      setListError(err);
      toast.error(`Error cargando lista: ${err.message}`, {
        id: 'list-error',
        duration: 5000,
      });
    } finally {
      setIsListLoading(false);
    }
  }, [viewport, filters, listPage, setListData, setIsListLoading, setListError]);

  // Debounce 300ms
  const debouncedFetch = useDebouncedCallback(fetchListData, 300);

  useEffect(() => {
    debouncedFetch();
  }, [viewport, filters, listPage, debouncedFetch]);

  return {
    properties: listProperties,
    total: listTotal,
    page: listPage,
    pages: listPages,
    isLoading: isListLoading,
    setPage: setListPage,
  };
}
