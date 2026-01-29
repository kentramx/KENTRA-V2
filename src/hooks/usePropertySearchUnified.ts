import { useEffect, useRef, useCallback } from 'react';
import { useMapStore, Cluster, MapProperty } from '@/stores/mapStore';
import { supabase } from '@/integrations/supabase/client';
import { useDebouncedCallback } from 'use-debounce';
import toast from 'react-hot-toast';

/**
 * Feature flag for the new vNext endpoint.
 * Set to true to use the new unified search with consistent totals.
 * Set to false to use the legacy property-search-h3.
 */
const USE_VNEXT_ENDPOINT = true;

/**
 * Unified hook for property search on map view.
 *
 * V4: Uses property-search-vNext for consistent totals between map and list.
 *
 * KEY GUARANTEE: total === COUNT of properties matching filters
 * - mapData and listItems derive from the SAME filtered dataset
 * - No more divergence between cluster counts and list counts
 *
 * Two modes:
 * 1. Clusters mode (zoom < 14): Shows aggregated clusters from spatial tree
 * 2. Properties mode (zoom >= 14): Shows individual properties
 *
 * Drill-down: Pass node_id to show properties within a specific tree node
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
    // Node-based drilling
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
      // Choose endpoint based on feature flag
      const endpoint = USE_VNEXT_ENDPOINT ? 'property-search-vNext' : 'property-search-h3';

      // Build request body - vNext uses slightly different param names
      const requestBody = USE_VNEXT_ENDPOINT
        ? {
            bounds: viewport?.bounds,
            zoom: viewport?.zoom,
            filters: {
              listing_type: filters.listing_type || undefined,
              property_type: filters.property_type || undefined,
              min_price: filters.min_price || undefined,
              max_price: filters.max_price || undefined,
              min_bedrooms: filters.min_bedrooms || undefined,
            },
            page: listPage,
            limit: 20,
            node_id: selectedNodeId || undefined,
          }
        : {
            bounds: viewport?.bounds,
            zoom: viewport?.zoom,
            filters,
            page: listPage,
            limit: 20,
            geohash_filter: selectedNodeId || undefined,
          };

      const { data, error } = await supabase.functions.invoke(endpoint, {
        body: requestBody,
      });

      if (error) throw error;

      // Log for comparison during migration
      if (USE_VNEXT_ENDPOINT) {
        console.log('[usePropertySearchUnified] vNext response', {
          mode: data.mode,
          mapDataLength: data.mapData?.length || 0,
          listItemsLength: data.listItems?.length || 0,
          total: data.total,
          page: data.page,
          totalPages: data.totalPages,
          meta: data._meta,
        });
      } else {
        console.log('[usePropertySearchUnified] legacy response', {
          mode: data.mode,
          mapDataLength: data.mapData?.length || 0,
          total: data.total,
        });
      }

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

    } catch (err: unknown) {
      const error = err as Error & { name?: string };
      if (error.name !== 'AbortError') {
        console.error('[usePropertySearchUnified] Error:', error);
        setMapError(error);
        setListError(error);
        toast.error(`Error cargando propiedades: ${error.message}`, {
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

    // Node-based drilling (Quadtree/Spatial tree system)
    selectedNodeId,
    setSelectedNodeId,

    // Legacy geohash drilling (backward compatibility)
    geohashFilter,
    setGeohashFilter,

    // Meta
    lastRequestMeta,

    // Feature flag status (for debugging)
    _usingVNext: USE_VNEXT_ENDPOINT,
  };
}
