/**
 * SearchMapEnterprise - Enterprise-grade map component for 5M+ properties
 *
 * Uses:
 * - MapLibre GL JS for base map
 * - Deck.gl for WebGL GPU-accelerated rendering
 * - H3 hexagonal indexes for hierarchical clustering
 * - Optional Martin tile server for vector tiles
 *
 * Renders millions of points at 60fps using GPU acceleration.
 */

import { useEffect, useRef, useCallback, memo, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Deck } from '@deck.gl/core';
import { ScatterplotLayer, TextLayer, IconLayer } from '@deck.gl/layers';
// Note: H3HexagonLayer requires @deck.gl/geo-layers
// import { H3HexagonLayer } from '@deck.gl/geo-layers';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { useMapStore } from '@/stores/mapStore';
import { usePropertySearchUnified } from '@/hooks/usePropertySearchUnified';

const MEXICO_CENTER: [number, number] = [-99.1332, 19.4326];
const INITIAL_ZOOM = 11;

// Martin tile server URL (set via environment variable)
const MARTIN_URL = import.meta.env.VITE_MARTIN_URL || '';

// Color scale for clusters based on count
const getClusterColor = (count: number): [number, number, number, number] => {
  if (count >= 1000) return [220, 38, 38, 220]; // red-600
  if (count >= 500) return [234, 88, 12, 220];  // orange-600
  if (count >= 100) return [0, 102, 255, 220];  // blue-600
  if (count >= 50) return [37, 99, 235, 200];   // blue-600 lighter
  return [59, 130, 246, 180];                   // blue-500
};

// Get cluster size based on count
const getClusterSize = (count: number): number => {
  return Math.min(60, 28 + Math.log10(count + 1) * 12);
};

interface ClusterData {
  id: string;
  lat: number;
  lng: number;
  count: number;
  avg_price?: number;
  min_price?: number;
  max_price?: number;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

interface PropertyData {
  id: string;
  lat: number;
  lng: number;
  price: number;
  listing_type: string;
}

export const SearchMapEnterprise = memo(function SearchMapEnterprise() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const deckOverlay = useRef<MapboxOverlay | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const isProgrammaticMoveRef = useRef(false);

  // Store
  const setViewport = useMapStore((s) => s.setViewport);
  const selectedPropertyId = useMapStore((s) => s.selectedPropertyId);
  const setSelectedPropertyId = useMapStore((s) => s.setSelectedPropertyId);
  const hoveredPropertyId = useMapStore((s) => s.hoveredPropertyId);
  const setHoveredPropertyId = useMapStore((s) => s.setHoveredPropertyId);

  // Data from unified endpoint
  const {
    mode,
    clusters,
    mapProperties,
    totalInViewport,
    isLoading,
    hasActiveFilters,
    setSelectedNodeId,
    selectedNodeId,
  } = usePropertySearchUnified();

  // ============================================
  // FORMAT PRICE FOR DISPLAY
  // ============================================
  const formatPrice = useCallback((price: number): string => {
    if (price >= 1000000) {
      return `$${(price / 1000000).toFixed(1)}M`;
    }
    return `$${Math.round(price / 1000)}K`;
  }, []);

  // ============================================
  // FORMAT CLUSTER COUNT
  // ============================================
  const formatCount = useCallback((count: number): string => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return String(count);
  }, []);

  // ============================================
  // INITIALIZE MAP
  // ============================================
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

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
        layers: [
          {
            id: 'carto-light-layer',
            type: 'raster',
            source: 'carto-light',
            minzoom: 0,
            maxzoom: 22,
          },
        ],
      },
      center: MEXICO_CENTER,
      zoom: INITIAL_ZOOM,
      maxZoom: 18,
      minZoom: 4,
    });

    // Add navigation control
    m.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Create Deck.gl overlay
    const overlay = new MapboxOverlay({
      interleaved: true,
      layers: [],
    });

    // Add overlay to map
    m.addControl(overlay as unknown as maplibregl.IControl);

    const updateViewport = () => {
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
    };

    // Handle user interaction (clear drill-down filter)
    const handleUserInteraction = () => {
      if (isProgrammaticMoveRef.current) {
        isProgrammaticMoveRef.current = false;
        updateViewport();
        return;
      }

      // Clear node filter on user-initiated movement
      if (useMapStore.getState().selectedNodeId) {
        console.log('[SearchMapEnterprise] User interaction, clearing node filter');
        useMapStore.getState().setSelectedNodeId(null);
      }
      updateViewport();
    };

    m.on('load', () => {
      console.log('[SearchMapEnterprise] Map loaded');

      // Add Martin vector tile sources if URL is configured
      if (MARTIN_URL) {
        m.addSource('martin-clusters', {
          type: 'vector',
          tiles: [`${MARTIN_URL}/h3_clusters/{z}/{x}/{y}`],
          minzoom: 0,
          maxzoom: 12,
        });

        m.addSource('martin-properties', {
          type: 'vector',
          tiles: [`${MARTIN_URL}/properties/{z}/{x}/{y}`],
          minzoom: 13,
          maxzoom: 18,
        });
      }

      updateViewport();
      setIsMapReady(true);
    });

    m.on('dragend', handleUserInteraction);
    m.on('zoomend', handleUserInteraction);

    map.current = m;
    deckOverlay.current = overlay;

    return () => {
      m.remove();
      map.current = null;
      deckOverlay.current = null;
      setIsMapReady(false);
    };
  }, [setViewport]);

  // ============================================
  // UPDATE DECK.GL LAYERS
  // ============================================
  useEffect(() => {
    if (!deckOverlay.current || !isMapReady) return;

    const layers: any[] = [];

    if (mode === 'clusters') {
      // ----------------------------------------
      // CLUSTER MODE: Render cluster circles
      // ----------------------------------------

      // Cluster circles
      layers.push(
        new ScatterplotLayer({
          id: 'cluster-circles',
          data: clusters,
          pickable: true,
          filled: true,
          stroked: true,
          getPosition: (d: ClusterData) => [d.lng, d.lat],
          getRadius: (d: ClusterData) => getClusterSize(d.count),
          getFillColor: (d: ClusterData) => getClusterColor(d.count),
          getLineColor: [255, 255, 255, 255],
          getLineWidth: 2,
          radiusUnits: 'pixels',
          lineWidthUnits: 'pixels',
          radiusMinPixels: 24,
          radiusMaxPixels: 60,
          onClick: (info) => {
            if (info.object) {
              const cluster = info.object as ClusterData;
              console.log('[SearchMapEnterprise] Cluster click:', cluster.id);

              // Set node filter for drill-down
              setSelectedNodeId(cluster.id);
              isProgrammaticMoveRef.current = true;

              // Zoom to cluster bounds
              if (cluster.bounds && map.current) {
                const { north, south, east, west } = cluster.bounds;
                map.current.fitBounds(
                  [
                    [west, south],
                    [east, north],
                  ],
                  { padding: 50, maxZoom: 16, duration: 500 }
                );
              } else if (map.current) {
                map.current.flyTo({
                  center: [cluster.lng, cluster.lat],
                  zoom: Math.min((map.current.getZoom() || 10) + 2, 16),
                  duration: 500,
                });
              }
            }
          },
          updateTriggers: {
            getRadius: [clusters],
            getFillColor: [clusters],
          },
        })
      );

      // Cluster labels (count)
      layers.push(
        new TextLayer({
          id: 'cluster-labels',
          data: clusters,
          pickable: false,
          getPosition: (d: ClusterData) => [d.lng, d.lat],
          getText: (d: ClusterData) => formatCount(d.count),
          getSize: 13,
          getColor: [255, 255, 255, 255],
          getTextAnchor: 'middle',
          getAlignmentBaseline: 'center',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 700,
          fontSettings: {
            sdf: true,
          },
          outlineColor: [0, 0, 0, 100],
          outlineWidth: 1,
          updateTriggers: {
            getText: [clusters],
          },
        })
      );
    } else {
      // ----------------------------------------
      // PROPERTIES MODE: Render price markers
      // ----------------------------------------

      // Property circles (background)
      layers.push(
        new ScatterplotLayer({
          id: 'property-circles',
          data: mapProperties,
          pickable: true,
          filled: true,
          stroked: true,
          getPosition: (d: PropertyData) => [d.lng, d.lat],
          getRadius: 24,
          getFillColor: (d: PropertyData) =>
            d.id === selectedPropertyId
              ? [0, 102, 255, 255] // Selected: blue
              : d.id === hoveredPropertyId
                ? [232, 240, 254, 255] // Hovered: light blue
                : [255, 255, 255, 255], // Default: white
          getLineColor: (d: PropertyData) =>
            d.id === selectedPropertyId ? [0, 82, 204, 255] : [200, 200, 200, 255],
          getLineWidth: 1,
          radiusUnits: 'pixels',
          lineWidthUnits: 'pixels',
          radiusMinPixels: 22,
          radiusMaxPixels: 32,
          onClick: (info) => {
            if (info.object) {
              setSelectedPropertyId((info.object as PropertyData).id);
            }
          },
          onHover: (info) => {
            if (info.object) {
              setHoveredPropertyId((info.object as PropertyData).id);
            } else {
              setHoveredPropertyId(null);
            }
          },
          updateTriggers: {
            getFillColor: [selectedPropertyId, hoveredPropertyId, mapProperties],
            getLineColor: [selectedPropertyId, mapProperties],
          },
        })
      );

      // Property price labels
      layers.push(
        new TextLayer({
          id: 'property-prices',
          data: mapProperties,
          pickable: false,
          getPosition: (d: PropertyData) => [d.lng, d.lat],
          getText: (d: PropertyData) => formatPrice(d.price),
          getSize: 11,
          getColor: (d: PropertyData) =>
            d.id === selectedPropertyId
              ? [255, 255, 255, 255] // Selected: white text
              : [26, 26, 26, 255], // Default: dark text
          getTextAnchor: 'middle',
          getAlignmentBaseline: 'center',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 600,
          updateTriggers: {
            getText: [mapProperties],
            getColor: [selectedPropertyId, mapProperties],
          },
        })
      );
    }

    // Update Deck.gl layers
    deckOverlay.current.setProps({ layers });
  }, [
    mode,
    clusters,
    mapProperties,
    selectedPropertyId,
    hoveredPropertyId,
    isMapReady,
    formatPrice,
    formatCount,
    setSelectedNodeId,
    setSelectedPropertyId,
    setHoveredPropertyId,
  ]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Property count badge */}
      <div className="absolute top-3 left-3 z-10 bg-white px-3 py-2 rounded-lg shadow-md">
        <span className="font-medium text-gray-900">
          {isLoading ? 'Cargando...' : `${totalInViewport.toLocaleString()} propiedades`}
        </span>
      </div>

      {/* Active filters indicator */}
      {hasActiveFilters && !selectedNodeId && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-blue-600 text-white px-3 py-1.5 rounded-full text-sm font-medium">
          Filtros activos
        </div>
      )}

      {/* Drill-down indicator */}
      {selectedNodeId && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-green-600 text-white px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2">
          <span>Viendo cluster: {totalInViewport.toLocaleString()} propiedades</span>
          <button
            onClick={() => setSelectedNodeId(null)}
            className="ml-1 hover:bg-green-700 rounded-full p-0.5"
            title="Volver al mapa completo"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Zoom hint */}
      {mode === 'clusters' && (
        <div className="absolute bottom-3 left-3 z-10 bg-black/70 text-white px-3 py-1.5 rounded text-sm">
          Acerca para ver precios
        </div>
      )}

      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute top-3 right-3 z-10">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Enterprise mode indicator (dev only) */}
      {import.meta.env.DEV && (
        <div className="absolute bottom-3 right-3 z-10 bg-purple-600/80 text-white px-2 py-1 rounded text-xs font-mono">
          Deck.gl {mode === 'clusters' ? `(${clusters.length} clusters)` : `(${mapProperties.length} props)`}
        </div>
      )}
    </div>
  );
});
