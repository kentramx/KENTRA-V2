import { useEffect, useRef, useCallback, memo, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMapStore } from '@/stores/mapStore';
import { supabase } from '@/integrations/supabase/client';
import { useDebouncedCallback } from 'use-debounce';

const MEXICO_CENTER: [number, number] = [-99.1332, 19.4326];
const INITIAL_ZOOM = 11;

interface ClusterData {
  id: string;
  geohash?: string;
  lat: number;
  lng: number;
  count: number;
}

interface PropertyData {
  id: string;
  lat: number;
  lng: number;
  price: number;
}

export const SearchMap = memo(function SearchMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const dataRef = useRef<{ mode: string; ids: Set<string> }>({ mode: '', ids: new Set() });

  // Solo funciones del store (estables)
  const setViewport = useMapStore((s) => s.setViewport);
  const setSelectedPropertyId = useMapStore((s) => s.setSelectedPropertyId);
  const setHoveredPropertyId = useMapStore((s) => s.setHoveredPropertyId);

  // Estado local para datos del mapa (evita re-renders del store)
  const viewport = useMapStore((s) => s.viewport);
  const filters = useMapStore((s) => s.filters);
  const selectedPropertyId = useMapStore((s) => s.selectedPropertyId);
  const hoveredPropertyId = useMapStore((s) => s.hoveredPropertyId);

  // Estado local para datos del mapa
  const modeRef = useRef<'clusters' | 'properties'>('clusters');
  const clustersRef = useRef<ClusterData[]>([]);
  const propertiesRef = useRef<PropertyData[]>([]);
  const totalRef = useRef(0);
  const loadingRef = useRef(false);

  // ============================================
  // INICIALIZAR MAPA (SOLO UNA VEZ)
  // ============================================
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'carto-light': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
            ],
            tileSize: 256,
            attribution: '© CARTO © OpenStreetMap',
          },
        },
        layers: [{
          id: 'carto-light-layer',
          type: 'raster',
          source: 'carto-light',
          minzoom: 0,
          maxzoom: 22,
        }],
      },
      center: MEXICO_CENTER,
      zoom: INITIAL_ZOOM,
      maxZoom: 18,
      minZoom: 4,
    });

    m.addControl(new maplibregl.NavigationControl(), 'top-right');

    m.on('load', () => {
      const bounds = m.getBounds();
      const center = m.getCenter();
      setViewport({
        bounds: {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        },
        zoom: Math.floor(m.getZoom()),
        center: { lat: center.lat, lng: center.lng },
      });
    });

    m.on('moveend', () => {
      const bounds = m.getBounds();
      const center = m.getCenter();
      setViewport({
        bounds: {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        },
        zoom: Math.floor(m.getZoom()),
        center: { lat: center.lat, lng: center.lng },
      });
    });

    mapRef.current = m;

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current.clear();
      m.remove();
      mapRef.current = null;
    };
  }, [setViewport]);

  // ============================================
  // FETCH DATA (DEBOUNCED, NO CAUSA RE-RENDER)
  // ============================================
  const fetchData = useCallback(async () => {
    if (!viewport || !mapRef.current) return;

    loadingRef.current = true;

    try {
      const { data, error } = await supabase.functions.invoke('map-clusters', {
        body: {
          bounds: viewport.bounds,
          zoom: viewport.zoom,
          filters,
        },
      });

      if (error) throw error;

      const newMode = data.mode as 'clusters' | 'properties';
      const newData = data.data || [];

      // Normalizar IDs
      if (newMode === 'clusters') {
        clustersRef.current = newData.map((c: any) => ({
          ...c,
          id: c.geohash || c.id || `${c.lat}-${c.lng}`,
        }));
        propertiesRef.current = [];
      } else {
        propertiesRef.current = newData;
        clustersRef.current = [];
      }

      modeRef.current = newMode;
      totalRef.current = data.total || 0;

      // Sincronizar markers AQUÍ, no en useEffect
      syncMarkers();

    } catch (err) {
      console.error('[SearchMap] Fetch error:', err);
    } finally {
      loadingRef.current = false;
    }
  }, [viewport, filters]);

  const debouncedFetch = useDebouncedCallback(fetchData, 300);

  // Fetch cuando cambia viewport o filters
  useEffect(() => {
    debouncedFetch();
  }, [viewport, filters, debouncedFetch]);

  // ============================================
  // SINCRONIZAR MARKERS (LLAMADO MANUALMENTE)
  // ============================================
  const syncMarkers = useCallback(() => {
    const m = mapRef.current;
    if (!m) return;

    const currentIds = new Set<string>();
    const mode = modeRef.current;

    // Si cambió el modo, limpiar todos los markers
    if (dataRef.current.mode !== mode) {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current.clear();
      dataRef.current.mode = mode;
      dataRef.current.ids.clear();
    }

    if (mode === 'clusters') {
      clustersRef.current.forEach((cluster) => {
        const id = cluster.id;
        currentIds.add(id);

        if (!markersRef.current.has(id)) {
          // Crear nuevo marker
          const size = Math.min(60, 30 + Math.log10(cluster.count + 1) * 15);
          const el = document.createElement('div');
          el.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            background: linear-gradient(180deg, #0066FF 0%, #0052CC 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: ${size > 40 ? '12px' : '10px'};
            border: 2px solid white;
            box-shadow: 0 2px 8px rgba(0,102,255,0.4);
            cursor: pointer;
          `;
          el.textContent = cluster.count >= 1000
            ? `${(cluster.count / 1000).toFixed(1)}K`
            : String(cluster.count);

          el.onclick = () => {
            m.flyTo({
              center: [cluster.lng, cluster.lat],
              zoom: m.getZoom() + 3,
              duration: 500,
            });
          };

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([cluster.lng, cluster.lat])
            .addTo(m);

          markersRef.current.set(id, marker);
        }
      });
    } else {
      propertiesRef.current.forEach((property) => {
        const id = property.id;
        currentIds.add(id);

        if (!markersRef.current.has(id)) {
          const el = document.createElement('div');
          el.style.cssText = `
            padding: 4px 8px;
            background: white;
            color: #1a1a1a;
            border-radius: 4px;
            font-weight: 600;
            font-size: 11px;
            border: 1px solid #e0e0e0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            cursor: pointer;
            white-space: nowrap;
          `;
          el.textContent = property.price >= 1000000
            ? `${(property.price / 1000000).toFixed(1)}M`
            : `${(property.price / 1000).toFixed(0)}K`;

          el.onclick = () => setSelectedPropertyId(property.id);
          el.onmouseenter = () => setHoveredPropertyId(property.id);
          el.onmouseleave = () => setHoveredPropertyId(null);

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([property.lng, property.lat])
            .addTo(m);

          markersRef.current.set(id, marker);
        }
      });
    }

    // Eliminar markers que ya no existen
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    dataRef.current.ids = currentIds;
  }, [setSelectedPropertyId, setHoveredPropertyId]);

  // ============================================
  // ACTUALIZAR ESTILOS HOVER/SELECTED (SIN TOCAR MARKERS)
  // ============================================
  useEffect(() => {
    if (modeRef.current !== 'properties') return;

    markersRef.current.forEach((marker, id) => {
      const el = marker.getElement();
      const isSelected = id === selectedPropertyId;
      const isHovered = id === hoveredPropertyId;

      el.style.background = isSelected ? '#0066FF' : isHovered ? '#E8F0FE' : 'white';
      el.style.color = isSelected ? 'white' : '#1a1a1a';
      el.style.borderColor = isSelected ? '#0052CC' : '#e0e0e0';
      el.style.zIndex = isSelected ? '10' : isHovered ? '5' : '1';
    });
  }, [selectedPropertyId, hoveredPropertyId]);

  // Calcular valores para UI
  const isLoading = loadingRef.current;
  const total = totalRef.current;
  const mode = modeRef.current;
  const hasActiveFilters = filters && Object.values(filters).some(v => v !== undefined && v !== null && v !== '');

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Badge de conteo */}
      <div className="absolute top-3 left-3 z-10 bg-white px-3 py-2 rounded-lg shadow-md">
        <span className="font-medium text-gray-900">
          {totalRef.current.toLocaleString()} propiedades
        </span>
      </div>

      {/* Indicador de filtros */}
      {hasActiveFilters && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-blue-600 text-white px-3 py-1.5 rounded-full text-sm font-medium">
          Filtros activos
        </div>
      )}

      {/* Indicador de modo */}
      {modeRef.current === 'clusters' && (
        <div className="absolute bottom-3 left-3 z-10 bg-black/70 text-white px-3 py-1.5 rounded text-sm">
          Acerca para ver precios
        </div>
      )}
    </div>
  );
});
