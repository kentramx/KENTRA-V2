/**
 * useMapData - Hook for fetching map data
 * Always fetches individual properties - clustering is done client-side with Supercluster
 */

import { useCallback, useEffect, useRef } from 'react';
import { useMapStore } from '@/stores/mapStore';
import { supabase } from '@/integrations/supabase/client';
import { useDebouncedCallback } from 'use-debounce';
import type { MapPropertyMarker, ListProperty } from '@/types/map';

export function useMapData() {
  const {
    viewport,
    filters,
    page,
    pageSize,
    setMapProperties,
    setListProperties,
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

    const { bounds } = viewport;

    try {
      // Always fetch individual properties - clustering is done client-side with Supercluster
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
        p_limit: 2000 // Higher limit for better client-side clustering
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

      // Convert to list properties for sidebar
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

    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message || 'Error fetching map data');
        console.error('Map data error:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [viewport, filters, pageSize, setMapProperties, setListProperties, setIsLoading, setError]);

  // Debounce fetch for pan/zoom
  const debouncedFetch = useDebouncedCallback(fetchData, 300);

  useEffect(() => {
    debouncedFetch();
  }, [viewport, filters, page, debouncedFetch]);

  return { refetch: fetchData };
}
