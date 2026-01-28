import { useEffect, useRef, useCallback } from 'react';
import { useMapStore, Cluster, MapProperty } from '@/stores/mapStore';
import { supabase } from '@/integrations/supabase/client';
import { useDebouncedCallback } from 'use-debounce';
import toast from 'react-hot-toast';

/**
 * Unified hook for property search on map view.
 *
 * V2: Uses Quadtree-based clustering with guaranteed count consistency.
 * Invariant: parent.count === SUM(children.count) ALWAYS
 *
 * Two modes:
 * 1. Viewport mode: Pass bounds + zoom for initial clusters
 * 2. Drill-down mode: Pass node_id for exact cluster expansion
 */
export function usePropertySearchUnified() {
  const {
    viewport,
    filters,
    listPage,
    setUnifiedData,
    setIsMapLoading,
    setIsListLoading,
    setMapError,
    setListError,
    setLastRequestMeta,
    setListPage,
    isMapLoading,
    isListLoading,
    mode,
    clusters,
    mapProperties,
    listProperties,
    totalInViewport,
    listTotal,
    listPages,
    hasActiveFilters,
    lastRequestMeta,
    // Node-based drilling (replaces geohashFilter)
    selectedNodeId,
    setSelectedNodeId,
    // Keep geohashFilter for backward compatibility during transition
    geohashFilter,
    setGeohashFilter,
  } = useMapStore();

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    // Need viewport to make a request
    if (!viewport) return;

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Set both loading states
    setIsMapLoading(true);
    setIsListLoading(true);
    setMapError(null);
    setListError(null);

    try {
      // TODO: Switch to property-search-tree once debugged
      // Using property-search-unified temporarily
      const { data, error } = await supabase.functions.invoke('property-search-unified', {
        body: {
          bounds: viewport?.bounds,
          zoom: viewport?.zoom,
          filters,
          page: listPage,
          limit: 20,
          // Pass geohash for exact cluster drilling (legacy system)
          geohash_filter: selectedNodeId || undefined,
        },
      });

      if (error) throw error;

      // Single action updates everything
      setUnifiedData({
        mode: data.mode,
        mapData: data.mapData || [],
        listItems: data.listItems || [],
        total: data.total || 0,
        page: data.page || 1,
        totalPages: data.totalPages || 0,
      });

      if (data._meta) {
        setLastRequestMeta(data._meta);
      }

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('[usePropertySearchUnified] Error:', err);
        setMapError(err);
        setListError(err);
        toast.error(`Error cargando propiedades: ${err.message}`, {
          id: 'unified-search-error',
          duration: 5000,
        });
      }
    } finally {
      setIsMapLoading(false);
      setIsListLoading(false);
    }
  }, [
    viewport,
    filters,
    listPage,
    selectedNodeId,
    setUnifiedData,
    setIsMapLoading,
    setIsListLoading,
    setMapError,
    setListError,
    setLastRequestMeta,
  ]);

  // Debounce 300ms
  const debouncedFetch = useDebouncedCallback(fetchData, 300);

  useEffect(() => {
    debouncedFetch();
  }, [viewport, filters, listPage, selectedNodeId, debouncedFetch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // Map data
    mode,
    clusters: clusters as Cluster[],
    mapProperties: mapProperties as MapProperty[],
    totalInViewport,

    // List data
    listProperties: listProperties as MapProperty[],
    listTotal,
    listPage,
    listPages,
    setListPage,

    // Loading states
    isMapLoading,
    isListLoading,
    isLoading: isMapLoading || isListLoading,

    // Filters
    hasActiveFilters: hasActiveFilters(),

    // Node-based drilling (new Quadtree system)
    selectedNodeId,
    setSelectedNodeId,

    // Legacy geohash drilling (backward compatibility)
    geohashFilter,
    setGeohashFilter,

    // Meta
    lastRequestMeta,
  };
}
