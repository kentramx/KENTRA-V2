/**
 * @deprecated Use usePropertySearchUnified instead.
 *
 * This hook fetches map data separately from list data, causing
 * inconsistencies in totals when filters are applied.
 *
 * Migration: usePropertySearchUnified provides unified, consistent responses
 * from the property-search-vNext endpoint.
 */
import { useEffect, useRef, useCallback } from 'react';
import { useMapStore } from '@/stores/mapStore';
import { supabase } from '@/integrations/supabase/client';
import { useDebouncedCallback } from 'use-debounce';
import toast from 'react-hot-toast';

/** @deprecated Use usePropertySearchUnified instead */
export function useMapData() {
  const {
    viewport,
    filters,
    setMapData,
    setIsMapLoading,
    setMapError,
    setLastRequestMeta,
    isMapLoading,
    mode,
    clusters,
    mapProperties,
    totalInViewport,
    hasActiveFilters,
    lastRequestMeta,
  } = useMapStore();

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchMapData = useCallback(async () => {
    if (!viewport) return;

    // Cancelar request anterior
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsMapLoading(true);
    setMapError(null);

    try {
      const { data, error } = await supabase.functions.invoke('map-clusters', {
        body: {
          bounds: viewport.bounds,
          zoom: viewport.zoom,
          filters,
        },
      });

      if (error) throw error;

      setMapData({
        mode: data.mode,
        data: data.data || [],
        total: data.total || 0,
      });

      if (data._meta) {
        setLastRequestMeta(data._meta);
      }

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('[useMapData] Error:', err);
        setMapError(err);
        toast.error(`Error cargando mapa: ${err.message}`, {
          id: 'map-error',
          duration: 5000,
        });
      }
    } finally {
      setIsMapLoading(false);
    }
  }, [viewport, filters, setMapData, setIsMapLoading, setMapError, setLastRequestMeta]);

  // Debounce 300ms
  const debouncedFetch = useDebouncedCallback(fetchMapData, 300);

  useEffect(() => {
    debouncedFetch();
  }, [viewport, filters, debouncedFetch]);

  return {
    mode,
    clusters,
    mapProperties,
    totalInViewport,
    isLoading: isMapLoading,
    lastRequestMeta,
    hasActiveFilters: hasActiveFilters(),
  };
}
