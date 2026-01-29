/**
 * Map Store - Zustand
 * Centralized state management for the map search system
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { MapViewport, MapFilters, MapCluster, MapPropertyMarker, ListProperty } from '@/types/map';

interface MapState {
  // Viewport
  viewport: MapViewport | null;
  setViewport: (viewport: MapViewport) => void;

  // Filters
  filters: MapFilters;
  setFilters: (filters: MapFilters) => void;
  updateFilter: <K extends keyof MapFilters>(key: K, value: MapFilters[K]) => void;
  resetFilters: () => void;

  // Mode
  isClusterMode: boolean;
  
  // Map data
  clusters: MapCluster[];
  mapProperties: MapPropertyMarker[];
  
  // List data
  listProperties: ListProperty[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  setPage: (page: number) => void;

  // UI state
  selectedPropertyId: string | null;
  hoveredPropertyId: string | null;
  setSelectedPropertyId: (id: string | null) => void;
  setHoveredPropertyId: (id: string | null) => void;

  // Loading state
  isLoading: boolean;
  error: string | null;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Data setters
  setClusters: (clusters: MapCluster[]) => void;
  setMapProperties: (properties: MapPropertyMarker[]) => void;
  setListProperties: (properties: ListProperty[], totalCount: number) => void;
  setIsClusterMode: (isCluster: boolean) => void;
}

const DEFAULT_PAGE_SIZE = 20;

export const useMapStore = create<MapState>()(
  subscribeWithSelector((set, get) => ({
    // Viewport
    viewport: null,
    setViewport: (viewport) => set({ viewport }),

    // Filters
    filters: {},
    setFilters: (filters) => set({ filters, page: 1 }),
    updateFilter: (key, value) => set((state) => ({
      filters: { ...state.filters, [key]: value },
      page: 1
    })),
    resetFilters: () => set({ filters: {}, page: 1 }),

    // Mode
    isClusterMode: true,
    setIsClusterMode: (isClusterMode) => set({ isClusterMode }),

    // Map data
    clusters: [],
    mapProperties: [],
    setClusters: (clusters) => set({ clusters, isClusterMode: true }),
    setMapProperties: (mapProperties) => set({ mapProperties, isClusterMode: false }),

    // List data
    listProperties: [],
    totalCount: 0,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    totalPages: 0,
    setPage: (page) => set({ page }),
    setListProperties: (listProperties, totalCount) => set({ 
      listProperties, 
      totalCount,
      totalPages: Math.ceil(totalCount / get().pageSize)
    }),

    // UI state
    selectedPropertyId: null,
    hoveredPropertyId: null,
    setSelectedPropertyId: (selectedPropertyId) => set({ selectedPropertyId }),
    setHoveredPropertyId: (hoveredPropertyId) => set({ hoveredPropertyId }),

    // Loading state
    isLoading: false,
    error: null,
    setIsLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
  }))
);

// Selectors for optimized subscriptions
export const selectViewport = (state: MapState) => state.viewport;
export const selectFilters = (state: MapState) => state.filters;
export const selectPage = (state: MapState) => state.page;
export const selectClusters = (state: MapState) => state.clusters;
export const selectMapProperties = (state: MapState) => state.mapProperties;
export const selectIsClusterMode = (state: MapState) => state.isClusterMode;
