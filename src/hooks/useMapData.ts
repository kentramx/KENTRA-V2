/**
 * useMapData - Hook for fetching map data
 * Handles clustering vs individual properties based on zoom level
 */

import { useCallback, useEffect, useRef } from 'react';
import { useMapStore } from '@/stores/mapStore';
import { supabase } from '@/integrations/supabase/client';
import { useDebouncedCallback } from 'use-debounce';
import { MEXICO_CONFIG, getClusterPrecision } from '@/types/map';
import type { MapCluster, MapPropertyMarker, ListProperty, MapFilters, MapBounds } from '@/types/map';

export function useMapData() {
  const {
    viewport,
    filters,
    page,
    pageSize,
    setClusters,
    setMapProperties,
    setListProperties,
    setIsClusterMode,
    setIsLoading,
    setError
  } = useMapStore();

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!viewport) return;

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    const { bounds, zoom } = viewport;
    const useClusterMode = zoom < MEXICO_CONFIG.clusterThreshold;

    try {
      if (useClusterMode) {
        // Fetch clusters
        const precision = getClusterPrecision(zoom);
        
        const { data, error } = await (supabase.rpc as unknown as (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)('get_map_clusters', {
          p_north: bounds.north,
          p_south: bounds.south,
          p_east: bounds.east,
          p_west: bounds.west,
          p_precision: precision,
          p_listing_type: filters.listing_type || null,
          p_property_type: filters.property_type || null,
          p_min_price: filters.min_price || null,
          p_max_price: filters.max_price || null,
          p_min_bedrooms: filters.min_bedrooms || null
        });

        if (error) throw error;

        const clusterData = data as Array<{ id: string; count: number; lat: number; lng: number; min_price: number; max_price: number }> | null;
        const clusters: MapCluster[] = (clusterData || []).map((c) => ({
          id: c.id,
          count: Number(c.count),
          lat: Number(c.lat),
          lng: Number(c.lng),
          min_price: Number(c.min_price),
          max_price: Number(c.max_price)
        }));

        setClusters(clusters);
        setIsClusterMode(true);

        // Calculate total count from clusters
        const totalCount = clusters.reduce((sum, c) => sum + c.count, 0);
        
        // For cluster mode, fetch a sample of properties for the list
        await fetchListProperties(bounds, filters, page, pageSize, totalCount);

      } else {
        // Fetch individual properties
        const { data, error } = await (supabase.rpc as unknown as (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)('get_map_data', {
          p_bounds_north: bounds.north,
          p_bounds_south: bounds.south,
          p_bounds_east: bounds.east,
          p_bounds_west: bounds.west,
          p_listing_type: filters.listing_type || null,
          p_property_type: filters.property_type || null,
          p_min_price: filters.min_price || null,
          p_max_price: filters.max_price || null,
          p_min_bedrooms: filters.min_bedrooms || null,
          p_limit: 500
        });

        if (error) throw error;

        const resultArray = data as Array<{ properties: unknown[]; total_count: number }> | null;
        const result = resultArray?.[0];
        const propertiesData = (result?.properties || []) as Array<{
          id: string;
          lat: number;
          lng: number;
          price: number;
          currency?: string;
          title: string;
          type: string;
          listing_type: string;
          address?: string;
          municipality?: string;
          state?: string;
          bedrooms?: number;
          bathrooms?: number;
          sqft?: number;
          is_featured?: boolean;
          agent?: { avatar_url?: string };
        }>;

        const properties: MapPropertyMarker[] = propertiesData.map((p) => ({
          id: p.id,
          lat: Number(p.lat),
          lng: Number(p.lng),
          price: Number(p.price),
          currency: p.currency || 'MXN',
          title: p.title,
          type: p.type,
          listing_type: p.listing_type,
          address: p.address || '',
          municipality: p.municipality || '',
          state: p.state || '',
          bedrooms: p.bedrooms ?? null,
          bathrooms: p.bathrooms ?? null,
          sqft: p.sqft ?? null,
          is_featured: p.is_featured || false,
          image_url: p.agent?.avatar_url || null
        }));

        setMapProperties(properties);
        setIsClusterMode(false);

        // Convert to list properties
        const listProps: ListProperty[] = properties.slice(0, pageSize).map(p => ({
          id: p.id,
          title: p.title,
          price: p.price,
          currency: p.currency,
          listing_type: p.listing_type,
          type: p.type,
          bedrooms: p.bedrooms,
          bathrooms: p.bathrooms,
          sqft: p.sqft,
          address: p.address,
          municipality: p.municipality,
          state: p.state,
          image_url: p.image_url,
          is_featured: p.is_featured
        }));

        setListProperties(listProps, result?.total_count || properties.length);
      }

    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message || 'Error fetching map data');
        console.error('Map data error:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [viewport, filters, page, pageSize, setClusters, setMapProperties, setListProperties, setIsClusterMode, setIsLoading, setError]);

  // Helper to fetch list properties
  const fetchListProperties = async (
    bounds: MapBounds,
    filtersParam: MapFilters,
    currentPage: number,
    pageSizeVal: number,
    totalCount: number
  ) => {
    let query = supabase
      .from('properties')
      .select('id, title, price, currency, listing_type, type, bedrooms, bathrooms, sqft, address, municipality, state, is_featured')
      .eq('status', 'activa')
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .gte('lat', bounds.south)
      .lte('lat', bounds.north)
      .gte('lng', bounds.west)
      .lte('lng', bounds.east);

    if (filtersParam.listing_type) {
      query = query.eq('listing_type', filtersParam.listing_type);
    }
    if (filtersParam.property_type) {
      query = query.eq('type', filtersParam.property_type as "bodega" | "casa" | "departamento" | "edificio" | "local" | "oficina" | "otro" | "rancho" | "terreno");
    }
    if (filtersParam.min_price) {
      query = query.gte('price', filtersParam.min_price);
    }
    if (filtersParam.max_price) {
      query = query.lte('price', filtersParam.max_price);
    }
    if (filtersParam.min_bedrooms) {
      query = query.gte('bedrooms', filtersParam.min_bedrooms);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range((currentPage - 1) * pageSizeVal, currentPage * pageSizeVal - 1);

    if (error) throw error;

    const listProps: ListProperty[] = (data || []).map((p) => ({
      id: p.id,
      title: p.title,
      price: p.price,
      currency: p.currency || 'MXN',
      listing_type: p.listing_type,
      type: p.type,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      sqft: p.sqft,
      address: p.address || '',
      municipality: p.municipality || '',
      state: p.state || '',
      image_url: null,
      is_featured: p.is_featured || false
    }));

    setListProperties(listProps, totalCount);
  };

  // Debounce fetch for pan/zoom
  const debouncedFetch = useDebouncedCallback(fetchData, 300);

  useEffect(() => {
    debouncedFetch();
  }, [viewport, filters, page, debouncedFetch]);

  return { refetch: fetchData };
}
