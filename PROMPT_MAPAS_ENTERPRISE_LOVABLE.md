# PROMPT ENTERPRISE: SISTEMA DE MAPAS KENTRA

## CONTEXTO

Kentra es un portal inmobiliario para México. Necesitamos implementar un sistema de mapas **enterprise-grade** capaz de manejar **5+ millones de propiedades** con performance de 60fps y queries < 200ms.

---

## TECH STACK EXISTENTE

```
Frontend: React 18 + TypeScript + Vite
UI: shadcn/ui + Tailwind CSS + Radix UI
State: Zustand
Backend: Supabase (PostgreSQL 15 + PostGIS 3.3)
Routing: React Router v6
Data: TanStack React Query
```

---

## ARQUITECTURA ENTERPRISE REQUERIDA

### Tier 1: Base de Datos (PostgreSQL + PostGIS)

```sql
-- La tabla properties YA EXISTE con estos campos de ubicación:
-- lat NUMERIC, lng NUMERIC, state TEXT, municipality TEXT, colonia TEXT

-- AGREGAR columna geometry para queries espaciales eficientes
ALTER TABLE properties ADD COLUMN IF NOT EXISTS
  geom GEOMETRY(Point, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)
  ) STORED;

-- Índice espacial GIST (crítico para performance)
CREATE INDEX IF NOT EXISTS idx_properties_geom_gist
  ON properties USING GIST(geom);

-- Índices para filtros comunes
CREATE INDEX IF NOT EXISTS idx_properties_active_location
  ON properties(status, state, municipality)
  WHERE status = 'activa';

CREATE INDEX IF NOT EXISTS idx_properties_listing_type
  ON properties(listing_type, status)
  WHERE status = 'activa';
```

### Tier 2: Clustering Jerárquico con Quadtree

```sql
-- Tabla de nodos del árbol espacial (pre-computado)
CREATE TABLE spatial_tree_nodes (
  id TEXT PRIMARY KEY,
  level INTEGER NOT NULL,  -- 0=root, 1-8=levels
  bounds BOX2D NOT NULL,
  center GEOMETRY(Point, 4326),
  parent_id TEXT REFERENCES spatial_tree_nodes(id),

  -- Conteos pre-agregados
  total_count INTEGER DEFAULT 0,
  count_venta INTEGER DEFAULT 0,
  count_renta INTEGER DEFAULT 0,

  -- Conteos por tipo
  count_casa INTEGER DEFAULT 0,
  count_departamento INTEGER DEFAULT 0,
  count_terreno INTEGER DEFAULT 0,
  count_oficina INTEGER DEFAULT 0,
  count_local INTEGER DEFAULT 0,
  count_otro INTEGER DEFAULT 0,

  -- Rangos de precio
  min_price NUMERIC,
  max_price NUMERIC,
  avg_price NUMERIC,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice espacial para queries de viewport
CREATE INDEX idx_spatial_tree_bounds
  ON spatial_tree_nodes USING GIST(bounds);

CREATE INDEX idx_spatial_tree_level
  ON spatial_tree_nodes(level);
```

### Tier 3: RPC Functions (PostgreSQL)

```sql
-- Función principal: búsqueda unificada mapa + lista
CREATE OR REPLACE FUNCTION search_map_and_list(
  -- Viewport
  p_north NUMERIC,
  p_south NUMERIC,
  p_east NUMERIC,
  p_west NUMERIC,
  p_zoom INTEGER,

  -- Filtros
  p_listing_type TEXT DEFAULT NULL,
  p_property_type TEXT DEFAULT NULL,
  p_min_price NUMERIC DEFAULT NULL,
  p_max_price NUMERIC DEFAULT NULL,
  p_min_bedrooms INTEGER DEFAULT NULL,
  p_min_bathrooms INTEGER DEFAULT NULL,

  -- Paginación
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mode TEXT;
  v_tree_level INTEGER;
  v_map_data JSONB;
  v_list_data JSONB;
  v_total INTEGER;
  v_start_time TIMESTAMPTZ := clock_timestamp();
BEGIN
  -- Determinar nivel del árbol según zoom
  v_tree_level := CASE
    WHEN p_zoom <= 6 THEN 1
    WHEN p_zoom <= 8 THEN 2
    WHEN p_zoom <= 10 THEN 3
    WHEN p_zoom <= 12 THEN 4
    WHEN p_zoom <= 14 THEN 5
    ELSE 6  -- Propiedades individuales
  END;

  -- Determinar modo
  v_mode := CASE WHEN p_zoom >= 14 THEN 'properties' ELSE 'clusters' END;

  IF v_mode = 'clusters' THEN
    -- Obtener clusters del árbol pre-computado
    SELECT jsonb_agg(cluster_data), COUNT(*)::INTEGER
    INTO v_map_data, v_total
    FROM (
      SELECT jsonb_build_object(
        'id', id,
        'lat', ST_Y(center),
        'lng', ST_X(center),
        'count', total_count,
        'avg_price', avg_price,
        'bounds', jsonb_build_object(
          'north', ST_YMax(bounds::geometry),
          'south', ST_YMin(bounds::geometry),
          'east', ST_XMax(bounds::geometry),
          'west', ST_XMin(bounds::geometry)
        )
      ) as cluster_data
      FROM spatial_tree_nodes
      WHERE level = v_tree_level
        AND bounds && ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)
        AND total_count > 0
      ORDER BY total_count DESC
      LIMIT 200
    ) clusters;
  ELSE
    -- Obtener propiedades individuales
    SELECT jsonb_agg(prop_data), COUNT(*)::INTEGER
    INTO v_map_data, v_total
    FROM (
      SELECT jsonb_build_object(
        'id', id,
        'lat', lat,
        'lng', lng,
        'price', price,
        'listing_type', listing_type,
        'property_type', type,
        'title', title,
        'slug', slug
      ) as prop_data
      FROM properties
      WHERE status = 'activa'
        AND lat IS NOT NULL AND lng IS NOT NULL
        AND geom && ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)
        AND (p_listing_type IS NULL OR listing_type = p_listing_type)
        AND (p_property_type IS NULL OR type = p_property_type)
        AND (p_min_price IS NULL OR price >= p_min_price)
        AND (p_max_price IS NULL OR price <= p_max_price)
        AND (p_min_bedrooms IS NULL OR bedrooms >= p_min_bedrooms)
      ORDER BY created_at DESC
      LIMIT 500
    ) props;
  END IF;

  -- Obtener lista paginada
  SELECT jsonb_agg(list_item)
  INTO v_list_data
  FROM (
    SELECT jsonb_build_object(
      'id', id,
      'title', title,
      'slug', slug,
      'price', price,
      'currency', currency,
      'listing_type', listing_type,
      'property_type', type,
      'bedrooms', bedrooms,
      'bathrooms', bathrooms,
      'sqft', sqft,
      'address', address,
      'city', municipality,
      'state', state,
      'image_url', images->0->>'url'
    ) as list_item
    FROM properties
    WHERE status = 'activa'
      AND lat IS NOT NULL AND lng IS NOT NULL
      AND geom && ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)
      AND (p_listing_type IS NULL OR listing_type = p_listing_type)
      AND (p_property_type IS NULL OR type = p_property_type)
      AND (p_min_price IS NULL OR price >= p_min_price)
      AND (p_max_price IS NULL OR price <= p_max_price)
      AND (p_min_bedrooms IS NULL OR bedrooms >= p_min_bedrooms)
    ORDER BY created_at DESC
    LIMIT p_limit
    OFFSET (p_page - 1) * p_limit
  ) list;

  RETURN jsonb_build_object(
    'mode', v_mode,
    'mapData', COALESCE(v_map_data, '[]'::jsonb),
    'listItems', COALESCE(v_list_data, '[]'::jsonb),
    'total', COALESCE(v_total, 0),
    'page', p_page,
    'totalPages', CEIL(COALESCE(v_total, 0)::NUMERIC / p_limit),
    '_meta', jsonb_build_object(
      'duration_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER,
      'tree_level', v_tree_level
    )
  );
END;
$$;
```

---

## CONFIGURACIÓN GEOGRÁFICA MÉXICO

```typescript
const MEXICO_CONFIG = {
  bounds: {
    north: 32.72,
    south: 14.53,
    west: -118.4,
    east: -86.7
  },

  defaultCenter: { lat: 23.6345, lng: -102.5528 },

  zoom: {
    default: 6,
    min: 4,
    max: 18,
    clustersUntil: 13,      // Clusters hasta zoom 13
    propertiesFrom: 14      // Propiedades individuales desde zoom 14
  },

  // Mapeo zoom → nivel del árbol
  zoomToTreeLevel: {
    5: 1, 6: 1,             // País
    7: 2, 8: 2,             // Región
    9: 3, 10: 3,            // Estado
    11: 4, 12: 4,           // Ciudad
    13: 5,                  // Distrito
    14: 6, 15: 6, 16: 6     // Propiedades
  }
}
```

---

## FRONTEND: ARQUITECTURA DE COMPONENTES

### 1. Store (Zustand) - `src/stores/mapStore.ts`

```typescript
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface Viewport {
  bounds: { north: number; south: number; east: number; west: number };
  zoom: number;
  center: { lat: number; lng: number };
}

interface Filters {
  listing_type?: 'venta' | 'renta';
  property_type?: string;
  min_price?: number;
  max_price?: number;
  min_bedrooms?: number;
  min_bathrooms?: number;
}

interface Cluster {
  id: string;
  lat: number;
  lng: number;
  count: number;
  avg_price?: number;
  bounds?: { north: number; south: number; east: number; west: number };
}

interface MapProperty {
  id: string;
  lat: number;
  lng: number;
  price: number;
  listing_type: string;
  property_type: string;
  title: string;
  slug: string;
}

interface ListProperty {
  id: string;
  title: string;
  slug: string;
  price: number;
  currency: string;
  listing_type: string;
  property_type: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  address: string;
  city: string;
  state: string;
  image_url: string;
}

interface MapState {
  // Viewport
  viewport: Viewport | null;
  setViewport: (viewport: Viewport) => void;

  // Filtros
  filters: Filters;
  setFilters: (filters: Filters) => void;
  updateFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  resetFilters: () => void;

  // Modo
  mode: 'clusters' | 'properties';

  // Datos del mapa
  clusters: Cluster[];
  mapProperties: MapProperty[];

  // Datos de la lista
  listProperties: ListProperty[];
  total: number;
  page: number;
  totalPages: number;
  setPage: (page: number) => void;

  // Acción unificada
  setData: (data: {
    mode: 'clusters' | 'properties';
    mapData: any[];
    listItems: ListProperty[];
    total: number;
    page: number;
    totalPages: number;
  }) => void;

  // UI
  selectedPropertyId: string | null;
  setSelectedPropertyId: (id: string | null) => void;
  hoveredPropertyId: string | null;
  setHoveredPropertyId: (id: string | null) => void;

  // Loading
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

export const useMapStore = create<MapState>()(
  subscribeWithSelector((set, get) => ({
    viewport: null,
    setViewport: (viewport) => set({ viewport }),

    filters: {},
    setFilters: (filters) => set({ filters, page: 1 }),
    updateFilter: (key, value) => set((state) => ({
      filters: { ...state.filters, [key]: value },
      page: 1
    })),
    resetFilters: () => set({ filters: {}, page: 1 }),

    mode: 'clusters',
    clusters: [],
    mapProperties: [],

    listProperties: [],
    total: 0,
    page: 1,
    totalPages: 0,
    setPage: (page) => set({ page }),

    setData: (data) => set({
      mode: data.mode,
      clusters: data.mode === 'clusters' ? data.mapData : [],
      mapProperties: data.mode === 'properties' ? data.mapData : [],
      listProperties: data.listItems,
      total: data.total,
      page: data.page,
      totalPages: data.totalPages
    }),

    selectedPropertyId: null,
    setSelectedPropertyId: (id) => set({ selectedPropertyId: id }),
    hoveredPropertyId: null,
    setHoveredPropertyId: (id) => set({ hoveredPropertyId: id }),

    isLoading: false,
    setIsLoading: (isLoading) => set({ isLoading }),
    error: null,
    setError: (error) => set({ error })
  }))
);
```

### 2. Hook de Búsqueda - `src/hooks/useMapSearch.ts`

```typescript
import { useEffect, useRef, useCallback } from 'react';
import { useMapStore } from '@/stores/mapStore';
import { supabase } from '@/integrations/supabase/client';
import { useDebouncedCallback } from 'use-debounce';

export function useMapSearch() {
  const {
    viewport,
    filters,
    page,
    setData,
    setIsLoading,
    setError
  } = useMapStore();

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!viewport) return;

    // Cancelar request anterior
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc('search_map_and_list', {
        p_north: viewport.bounds.north,
        p_south: viewport.bounds.south,
        p_east: viewport.bounds.east,
        p_west: viewport.bounds.west,
        p_zoom: viewport.zoom,
        p_listing_type: filters.listing_type || null,
        p_property_type: filters.property_type || null,
        p_min_price: filters.min_price || null,
        p_max_price: filters.max_price || null,
        p_min_bedrooms: filters.min_bedrooms || null,
        p_page: page,
        p_limit: 20
      });

      if (error) throw error;

      setData({
        mode: data.mode,
        mapData: data.mapData,
        listItems: data.listItems,
        total: data.total,
        page: data.page,
        totalPages: data.totalPages
      });
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Error fetching data');
        console.error('Map search error:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [viewport, filters, page, setData, setIsLoading, setError]);

  // Debounce para pan/zoom
  const debouncedFetch = useDebouncedCallback(fetchData, 300);

  useEffect(() => {
    debouncedFetch();
  }, [viewport, filters, page]);

  return { refetch: fetchData };
}
```

### 3. Componente Mapa Principal - `src/components/search/SearchMap.tsx`

```typescript
import { useEffect, useRef, useCallback, memo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMapStore } from '@/stores/mapStore';
import { useMapSearch } from '@/hooks/useMapSearch';

const MEXICO_BOUNDS: [[number, number], [number, number]] = [
  [-118.4, 14.53],  // SW
  [-86.7, 32.72]    // NE
];

const CARTO_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

export const SearchMap = memo(function SearchMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  const {
    mode,
    clusters,
    mapProperties,
    selectedPropertyId,
    hoveredPropertyId,
    setViewport,
    setSelectedPropertyId,
    setHoveredPropertyId
  } = useMapStore();

  useMapSearch();

  // Inicializar mapa
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: CARTO_STYLE,
      center: [-102.5528, 23.6345],
      zoom: 6,
      maxBounds: MEXICO_BOUNDS,
      minZoom: 4,
      maxZoom: 18
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('moveend', () => {
      const bounds = map.getBounds();
      const center = map.getCenter();

      setViewport({
        bounds: {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest()
        },
        zoom: Math.round(map.getZoom()),
        center: { lat: center.lat, lng: center.lng }
      });
    });

    // Trigger inicial
    map.once('load', () => {
      map.fire('moveend');
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [setViewport]);

  // Renderizar clusters
  useEffect(() => {
    if (!mapRef.current || mode !== 'clusters') return;

    // Limpiar marcadores anteriores
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();

    clusters.forEach(cluster => {
      const el = document.createElement('div');
      el.className = 'cluster-marker';
      el.innerHTML = `
        <div class="cluster-circle" style="
          width: ${Math.min(60, 30 + cluster.count / 100)}px;
          height: ${Math.min(60, 30 + cluster.count / 100)}px;
        ">
          ${formatCount(cluster.count)}
        </div>
      `;

      el.addEventListener('click', () => {
        if (cluster.bounds && mapRef.current) {
          mapRef.current.fitBounds([
            [cluster.bounds.west, cluster.bounds.south],
            [cluster.bounds.east, cluster.bounds.north]
          ], { padding: 50 });
        }
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([cluster.lng, cluster.lat])
        .addTo(mapRef.current!);

      markersRef.current.set(cluster.id, marker);
    });
  }, [clusters, mode]);

  // Renderizar propiedades individuales
  useEffect(() => {
    if (!mapRef.current || mode !== 'properties') return;

    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();

    mapProperties.forEach(prop => {
      const isSelected = prop.id === selectedPropertyId;
      const isHovered = prop.id === hoveredPropertyId;

      const el = document.createElement('div');
      el.className = `property-marker ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`;
      el.innerHTML = `
        <div class="price-pill ${prop.listing_type === 'renta' ? 'rent' : 'sale'}">
          ${formatPrice(prop.price)}
        </div>
      `;

      el.addEventListener('click', () => setSelectedPropertyId(prop.id));
      el.addEventListener('mouseenter', () => setHoveredPropertyId(prop.id));
      el.addEventListener('mouseleave', () => setHoveredPropertyId(null));

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([prop.lng, prop.lat])
        .addTo(mapRef.current!);

      markersRef.current.set(prop.id, marker);
    });
  }, [mapProperties, mode, selectedPropertyId, hoveredPropertyId]);

  return (
    <div ref={mapContainerRef} className="w-full h-full" />
  );
});

function formatCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(0)}K`;
  return count.toString();
}

function formatPrice(price: number): string {
  if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
  if (price >= 1000) return `$${(price / 1000).toFixed(0)}K`;
  return `$${price}`;
}
```

### 4. Componente Filtros - `src/components/search/MapFilters.tsx`

```typescript
import { useMapStore } from '@/stores/mapStore';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';
import { PROPERTY_TYPES, PROPERTY_CATEGORIES } from '@/config/propertyTypes';

export function MapFilters() {
  const { filters, updateFilter, resetFilters } = useMapStore();

  const hasFilters = Object.values(filters).some(v => v !== undefined);

  return (
    <div className="flex items-center gap-2 p-3 bg-background border-b">
      {/* Tipo de operación */}
      <div className="flex rounded-lg border overflow-hidden">
        <Button
          variant={filters.listing_type === 'venta' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => updateFilter('listing_type', 'venta')}
          className="rounded-none"
        >
          Venta
        </Button>
        <Button
          variant={filters.listing_type === 'renta' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => updateFilter('listing_type', 'renta')}
          className="rounded-none"
        >
          Renta
        </Button>
      </div>

      {/* Tipo de propiedad */}
      <Select
        value={filters.property_type || ''}
        onValueChange={(v) => updateFilter('property_type', v || undefined)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Todos</SelectItem>
          {PROPERTY_TYPES.map(type => (
            <SelectItem key={type.value} value={type.value}>
              {type.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Precio mínimo */}
      <Input
        type="number"
        placeholder="Precio mín"
        className="w-[120px]"
        value={filters.min_price || ''}
        onChange={(e) => updateFilter('min_price', e.target.value ? Number(e.target.value) : undefined)}
      />

      {/* Precio máximo */}
      <Input
        type="number"
        placeholder="Precio máx"
        className="w-[120px]"
        value={filters.max_price || ''}
        onChange={(e) => updateFilter('max_price', e.target.value ? Number(e.target.value) : undefined)}
      />

      {/* Recámaras */}
      <Select
        value={filters.min_bedrooms?.toString() || ''}
        onValueChange={(v) => updateFilter('min_bedrooms', v ? Number(v) : undefined)}
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="Recámaras" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Cualquiera</SelectItem>
          <SelectItem value="1">1+</SelectItem>
          <SelectItem value="2">2+</SelectItem>
          <SelectItem value="3">3+</SelectItem>
          <SelectItem value="4">4+</SelectItem>
        </SelectContent>
      </Select>

      {/* Limpiar filtros */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          <X className="h-4 w-4 mr-1" />
          Limpiar
        </Button>
      )}
    </div>
  );
}
```

### 5. Lista de Propiedades - `src/components/search/PropertyList.tsx`

```typescript
import { useMapStore } from '@/stores/mapStore';
import { PropertyCard } from '@/components/PropertyCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function PropertyList() {
  const {
    listProperties,
    total,
    page,
    totalPages,
    setPage,
    isLoading,
    selectedPropertyId,
    setSelectedPropertyId,
    setHoveredPropertyId
  } = useMapStore();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <h2 className="font-semibold">
          {total.toLocaleString()} propiedades encontradas
        </h2>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[200px] w-full rounded-lg" />
          ))
        ) : (
          listProperties.map(property => (
            <PropertyCard
              key={property.id}
              property={property}
              isSelected={property.id === selectedPropertyId}
              onClick={() => setSelectedPropertyId(property.id)}
              onMouseEnter={() => setHoveredPropertyId(property.id)}
              onMouseLeave={() => setHoveredPropertyId(null)}
            />
          ))
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="p-4 border-t flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>

          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
```

### 6. Página Buscar - `src/pages/Buscar.tsx`

```typescript
import { MapFilters } from '@/components/search/MapFilters';
import { SearchMap } from '@/components/search/SearchMap';
import { PropertyList } from '@/components/search/PropertyList';
import Navbar from '@/components/Navbar';

export default function Buscar() {
  return (
    <div className="h-screen flex flex-col">
      <Navbar />

      {/* Filtros */}
      <MapFilters />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Lista (desktop) */}
        <div className="hidden lg:block w-[400px] flex-shrink-0 border-r">
          <PropertyList />
        </div>

        {/* Mapa */}
        <div className="flex-1 relative">
          <SearchMap />
        </div>
      </div>
    </div>
  );
}
```

---

## ESTILOS CSS REQUERIDOS

```css
/* Cluster markers */
.cluster-marker {
  cursor: pointer;
}

.cluster-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  background: hsl(var(--primary));
  color: white;
  border-radius: 50%;
  font-weight: 700;
  font-size: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  border: 2px solid white;
  transition: transform 0.2s;
}

.cluster-marker:hover .cluster-circle {
  transform: scale(1.1);
}

/* Property markers */
.property-marker {
  cursor: pointer;
}

.price-pill {
  background: white;
  padding: 4px 10px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 13px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border: 2px solid transparent;
  white-space: nowrap;
  transition: all 0.2s;
}

.price-pill.sale {
  border-color: hsl(var(--primary));
  color: hsl(var(--primary));
}

.price-pill.rent {
  border-color: hsl(217, 91%, 60%);
  color: hsl(217, 91%, 60%);
}

.property-marker:hover .price-pill,
.property-marker.hovered .price-pill {
  transform: scale(1.1);
  z-index: 100;
}

.property-marker.selected .price-pill {
  background: hsl(var(--primary));
  color: white;
  transform: scale(1.15);
  z-index: 200;
}
```

---

## DEPENDENCIAS A INSTALAR

```bash
npm install maplibre-gl
npm install -D @types/maplibre-gl
```

---

## TIPOS DE PROPIEDAD

```typescript
// Residencial
'casa' | 'departamento' | 'penthouse' | 'villa' | 'townhouse' | 'estudio' | 'rancho'

// Comercial
'oficina' | 'local' | 'bodega' | 'edificio'

// Terreno
'terreno'
```

---

## PERFORMANCE TARGETS

| Métrica | Target |
|---------|--------|
| Query RPC (viewport) | < 200ms |
| Render clusters | < 16ms (60fps) |
| Cambio de filtros | < 300ms |
| Zoom transition | 60fps |
| Max clusters | 200 |
| Max propiedades visibles | 500 |
| Bundle size (mapa) | < 200KB gzip |

---

## MIGRACIONES SQL REQUERIDAS

Crear archivo: `supabase/migrations/[timestamp]_map_infrastructure.sql`

```sql
-- 1. Columna geometry generada
ALTER TABLE properties ADD COLUMN IF NOT EXISTS
  geom GEOMETRY(Point, 4326) GENERATED ALWAYS AS (
    CASE WHEN lat IS NOT NULL AND lng IS NOT NULL
    THEN ST_SetSRID(ST_MakePoint(lng, lat), 4326)
    ELSE NULL END
  ) STORED;

-- 2. Índice espacial
CREATE INDEX IF NOT EXISTS idx_properties_geom_gist
  ON properties USING GIST(geom);

-- 3. Tabla de árbol espacial
CREATE TABLE IF NOT EXISTS spatial_tree_nodes (
  id TEXT PRIMARY KEY,
  level INTEGER NOT NULL,
  bounds BOX2D NOT NULL,
  center GEOMETRY(Point, 4326),
  parent_id TEXT REFERENCES spatial_tree_nodes(id),
  total_count INTEGER DEFAULT 0,
  count_venta INTEGER DEFAULT 0,
  count_renta INTEGER DEFAULT 0,
  min_price NUMERIC,
  max_price NUMERIC,
  avg_price NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spatial_tree_bounds
  ON spatial_tree_nodes USING GIST(bounds);

-- 4. RPC function (ver definición completa arriba)
-- CREATE OR REPLACE FUNCTION search_map_and_list(...) ...
```

---

## CRITERIOS DE ACEPTACIÓN

1. ✅ Mapa carga centrado en México en < 1 segundo
2. ✅ Zoom out (< 14) muestra clusters con conteo exacto
3. ✅ Zoom in (≥ 14) muestra marcadores de precio individuales
4. ✅ Click en cluster hace zoom al área
5. ✅ Click en propiedad la selecciona y resalta
6. ✅ Hover sincroniza entre mapa y lista
7. ✅ Filtros actualizan mapa y lista instantáneamente
8. ✅ Paginación funciona correctamente
9. ✅ Total de resultados es consistente entre mapa y lista
10. ✅ Performance de 60fps durante pan/zoom
11. ✅ Responsive: móvil muestra drawer para lista
12. ✅ Queries < 200ms para 5M+ propiedades

---

## NOTAS IMPORTANTES

1. **Solo propiedades activas:** `status = 'activa'`
2. **Coordenadas válidas:** Solo propiedades con `lat` y `lng` no nulos
3. **Límites de México:** Restringir navegación a bounds de México
4. **Precios en MXN:** Formatear con `$` y sufijos K/M
5. **Idioma español:** Todo el UI en español
6. **PostGIS ya habilitado:** v3.3.7 disponible en Supabase
