import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// ============================================
// TYPES
// ============================================
export interface Viewport {
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  zoom: number;
  center: { lat: number; lng: number };
}

export interface Filters {
  listing_type?: 'venta' | 'renta';
  property_type?: string;
  min_price?: number;
  max_price?: number;
  min_bedrooms?: number;
  max_bedrooms?: number;
  min_bathrooms?: number;
  city?: string;
  state?: string;
}

export interface Cluster {
  id: string;
  lat: number;
  lng: number;
  count: number;
  avg_price: number;
  min_price?: number;
  max_price?: number;
}

export interface MapProperty {
  id: string;
  title: string;
  slug: string;
  lat: number;
  lng: number;
  price: number;
  listing_type: string;
  property_type: string;
  bedrooms: number;
  bathrooms: number;
  construction_m2?: number;
  address?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  image_url?: string;
}

export interface RequestMeta {
  request_id: string;
  duration_ms: number;
  db_query_ms?: number;
  timestamp: string;
}

// ============================================
// STORE
// ============================================
interface MapState {
  // Viewport
  viewport: Viewport | null;
  setViewport: (viewport: Viewport) => void;

  // Filters
  filters: Filters;
  setFilters: (filters: Filters) => void;
  updateFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  resetFilters: () => void;
  hasActiveFilters: () => boolean;

  // Map Data
  mode: 'clusters' | 'properties';
  clusters: Cluster[];
  mapProperties: MapProperty[];
  totalInViewport: number;

  // List Data
  listProperties: MapProperty[];
  listTotal: number;
  listPage: number;
  listPages: number;

  // Actions
  setMapData: (data: {
    mode: 'clusters' | 'properties';
    data: any[];
    total: number;
  }) => void;
  setListData: (data: {
    properties: MapProperty[];
    total: number;
    page: number;
    pages: number;
  }) => void;
  setListPage: (page: number) => void;

  // UI State
  selectedPropertyId: string | null;
  setSelectedPropertyId: (id: string | null) => void;

  hoveredPropertyId: string | null;
  setHoveredPropertyId: (id: string | null) => void;

  // Loading States
  isMapLoading: boolean;
  setIsMapLoading: (loading: boolean) => void;

  isListLoading: boolean;
  setIsListLoading: (loading: boolean) => void;

  // Error States
  mapError: Error | null;
  setMapError: (error: Error | null) => void;

  listError: Error | null;
  setListError: (error: Error | null) => void;

  // Metrics
  lastRequestMeta: RequestMeta | null;
  setLastRequestMeta: (meta: RequestMeta | null) => void;
}

const DEFAULT_FILTERS: Filters = {};

export const useMapStore = create<MapState>()(
  subscribeWithSelector((set, get) => ({
    // Viewport
    viewport: null,
    setViewport: (viewport) => set({ viewport }),

    // Filters
    filters: DEFAULT_FILTERS,
    setFilters: (filters) => set({ filters, listPage: 1 }),
    updateFilter: (key, value) => set((state) => ({
      filters: { ...state.filters, [key]: value },
      listPage: 1,
    })),
    resetFilters: () => set({ filters: DEFAULT_FILTERS, listPage: 1 }),
    hasActiveFilters: () => {
      const { filters } = get();
      return Object.values(filters).some(v => v !== undefined && v !== null && v !== '');
    },

    // Map Data
    mode: 'clusters',
    clusters: [],
    mapProperties: [],
    totalInViewport: 0,

    // List Data
    listProperties: [],
    listTotal: 0,
    listPage: 1,
    listPages: 0,

    // Actions
    setMapData: (data) => set({
      mode: data.mode,
      clusters: data.mode === 'clusters' ? data.data : [],
      mapProperties: data.mode === 'properties' ? data.data : [],
      totalInViewport: data.total,
    }),
    setListData: (data) => set({
      listProperties: data.properties,
      listTotal: data.total,
      listPage: data.page,
      listPages: data.pages,
    }),
    setListPage: (page) => set({ listPage: page }),

    // UI State
    selectedPropertyId: null,
    setSelectedPropertyId: (id) => set({ selectedPropertyId: id }),

    hoveredPropertyId: null,
    setHoveredPropertyId: (id) => set({ hoveredPropertyId: id }),

    // Loading
    isMapLoading: false,
    setIsMapLoading: (isMapLoading) => set({ isMapLoading }),

    isListLoading: false,
    setIsListLoading: (isListLoading) => set({ isListLoading }),

    // Errors
    mapError: null,
    setMapError: (mapError) => set({ mapError }),

    listError: null,
    setListError: (listError) => set({ listError }),

    // Metrics
    lastRequestMeta: null,
    setLastRequestMeta: (lastRequestMeta) => set({ lastRequestMeta }),
  }))
);
