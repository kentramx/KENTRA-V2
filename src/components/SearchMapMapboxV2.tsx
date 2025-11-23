/**
 * ✅ Componente de mapa V2 con Mapbox GL JS (WebGL layers)
 * - Arquitectura ultra-escalable tipo Zillow
 * - GeoJSON source + layers (NO DOM markers)
 * - Prefetch de tiles vecinos
 * - Hard cap visual con overlay
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// ✅ FIX CSP/Worker para Vite/Lovable (evita blob worker bloqueado)
import MapboxWorker from 'mapbox-gl/dist/mapbox-gl-csp-worker?worker';
mapboxgl.workerClass = MapboxWorker;

import { useTiledMapV2, ViewportBounds, MIN_ZOOM_FOR_TILES, MAX_PROPERTIES_PER_TILE } from '@/hooks/useTiledMapV2';
import type { MapProperty, PropertyFilters } from '@/types/property';
import { monitoring } from '@/lib/monitoring';
import { Loader2, AlertCircle, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SearchMapMapboxV2Props {
  filters: PropertyFilters;
  searchCoordinates: { lat: number; lng: number } | null;
  onMarkerClick: (id: string) => void;
  onPropertyHover?: (property: MapProperty | null) => void;
  hoveredPropertyId?: string | null;
  hoveredPropertyCoords?: { lat: number; lng: number } | null;
  height?: string;
  onMapError?: (error: string) => void;
  onVisibleCountChange?: (count: number) => void;
  onMapPositionChange?: (center: { lat: number; lng: number }, bounds: ViewportBounds) => void;
}

export const SearchMapMapboxV2: React.FC<SearchMapMapboxV2Props> = ({
  filters,
  searchCoordinates,
  onMarkerClick,
  onPropertyHover,
  hoveredPropertyId,
  hoveredPropertyCoords,
  height = '100%',
  onMapError,
  onVisibleCountChange,
  onMapPositionChange,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const didInitRef = useRef(false);
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const previousMarkersRef = useRef<any[]>([]);

  // 🚀 TILE-BASED ARCHITECTURE V2
  const { data: viewportData, isLoading, error } = useTiledMapV2(
    viewportBounds,
    { ...filters, status: ['activa'] }
  );

  const { properties = [], clusters = [], hasTooManyResults = false } = viewportData || {};

  // ✅ Calcular y reportar el total de propiedades visibles
  useEffect(() => {
    if (!onVisibleCountChange) return;

    const totalVisible =
      (properties?.length || 0) + (clusters?.reduce((acc, c) => acc + c.property_count, 0) || 0);

    onVisibleCountChange(totalVisible);
  }, [properties, clusters, onVisibleCountChange]);

  // ✅ Inicialización Mapbox estable (solo una vez con didInitRef)
  useEffect(() => {
    if (didInitRef.current || !mapContainer.current) return;
    didInitRef.current = true;

    // ✅ Acepta cualquiera de los dos nombres de env (retrocompatibilidad)
    const token =
      import.meta.env.VITE_MAPBOX_TOKEN ||
      import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ||
      '';

    if (import.meta.env.DEV) {
      console.log('[Mapbox Token Check]', {
        hasVITE_MAPBOX_TOKEN: !!import.meta.env.VITE_MAPBOX_TOKEN,
        hasVITE_MAPBOX_ACCESS_TOKEN: !!import.meta.env.VITE_MAPBOX_ACCESS_TOKEN,
        tokenLength: token.length,
      });
    }

    if (!token) {
      const errorMsg =
        'Falta token de Mapbox. Configura VITE_MAPBOX_TOKEN (o VITE_MAPBOX_ACCESS_TOKEN) en Lovable Cloud Secrets.';
      setMapError(errorMsg);
      monitoring.error('[SearchMapMapboxV2] Token no configurado');
      onMapError?.(errorMsg);
      return;
    }

    mapboxgl.accessToken = token;

    const center: [number, number] = searchCoordinates
      ? [searchCoordinates.lng, searchCoordinates.lat]
      : [-102.5528, 23.6345]; // Centro de México
    const zoom = searchCoordinates ? 12 : 5;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center,
      zoom,
    });

    mapRef.current = map;

    // ✅ Capturar errores de Mapbox (403 token, CSP, style fail, etc.)
    map.on('error', (e: any) => {
      const msg =
        e?.error?.message ||
        e?.message ||
        'Error desconocido de Mapbox';

      console.error('[Mapbox error event]', e);

      setMapError(msg);
      onMapError?.(msg);
    });

    map.on('load', () => {
      // ✅ Crear source + layers SOLO en load
      map.addSource('kentra-points-v2', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Layer: Clusters circle
      map.addLayer({
        id: 'clusters-circle-v2',
        type: 'circle',
        source: 'kentra-points-v2',
        filter: ['==', ['get', 'type'], 'cluster'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'count'],
            '#0EA5E9',
            10,
            '#3B82F6',
            50,
            '#6366F1',
            100,
            '#8B5CF6',
          ],
          'circle-radius': ['step', ['get', 'count'], 20, 10, 30, 50, 40, 100, 50],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Layer: Clusters count
      map.addLayer({
        id: 'clusters-count-v2',
        type: 'symbol',
        source: 'kentra-points-v2',
        filter: ['==', ['get', 'type'], 'cluster'],
        layout: {
          'text-field': ['get', 'count'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 14,
        },
        paint: {
          'text-color': '#ffffff',
        },
      });

      // Layer: Properties circle
      map.addLayer({
        id: 'properties-circle-v2',
        type: 'circle',
        source: 'kentra-points-v2',
        filter: ['==', ['get', 'type'], 'property'],
        paint: {
          'circle-color': [
            'case',
            ['boolean', ['get', 'isHovered'], false],
            '#F59E0B',
            '#10B981',
          ],
          'circle-radius': ['case', ['boolean', ['get', 'isHovered'], false], 12, 8],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });
    });

    // ✅ Listener moveend para calcular bounds y notificar
    map.on('moveend', () => {
      const mapBounds = map.getBounds();
      const zoom = map.getZoom();

      const bounds: ViewportBounds = {
        minLng: mapBounds.getWest(),
        minLat: mapBounds.getSouth(),
        maxLng: mapBounds.getEast(),
        maxLat: mapBounds.getNorth(),
        zoom: Math.round(zoom),
      };

      setViewportBounds(bounds);

      const center = map.getCenter();
      onMapPositionChange?.({ lat: center.lat, lng: center.lng }, bounds);
    });

    // ✅ Interacciones: click en cluster → zoom +2
    map.on('click', 'clusters-circle-v2', (e) => {
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const coordinates = (feature.geometry as any).coordinates.slice();
      const zoom = map.getZoom();

      map.easeTo({
        center: coordinates,
        zoom: Math.min(zoom + 2, 18),
        duration: 500,
      });
    });

    // ✅ Interacciones: click en property → onMarkerClick
    map.on('click', 'properties-circle-v2', (e) => {
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const id = feature.properties?.id;
      if (id) {
        onMarkerClick(id);
      }
    });

    // ✅ Interacciones: hover en property
    map.on('mouseenter', 'properties-circle-v2', (e) => {
      map.getCanvas().style.cursor = 'pointer';
      if (!e.features || e.features.length === 0 || !onPropertyHover) return;
      const feature = e.features[0];
      const id = feature.properties?.id;
      const property = properties.find((p) => p.id === id);
      if (property) {
        onPropertyHover(property);
      }
    });

    map.on('mouseleave', 'properties-circle-v2', () => {
      map.getCanvas().style.cursor = '';
      onPropertyHover?.(null);
    });

    // ✅ Hover en cluster
    map.on('mouseenter', 'clusters-circle-v2', () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'clusters-circle-v2', () => {
      map.getCanvas().style.cursor = '';
    });

    return () => {
      map.remove();
      didInitRef.current = false;
    };
  }, []); // Solo inicializar una vez

  // ✅ Update de datos con source.setData()
  useEffect(() => {
    if (!mapRef.current) return;

    const source = mapRef.current.getSource('kentra-points-v2') as mapboxgl.GeoJSONSource;
    if (!source) return; // Guard correcto

    const features: any[] = [];

    // ✅ Solo renderizar properties si NO está saturado
    if (!hasTooManyResults) {
      properties.forEach((p) => {
        if (!p.lat || !p.lng || isNaN(Number(p.lat)) || isNaN(Number(p.lng))) return;
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [Number(p.lng), Number(p.lat)] },
          properties: {
            id: p.id,
            type: 'property',
            title: p.title,
            price: p.price,
            isHovered: hoveredPropertyId === p.id,
          },
        });
      });
    }

    clusters.forEach((c) => {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
        properties: {
          id: c.cluster_id,
          type: 'cluster',
          count: c.property_count,
          avgPrice: c.avg_price,
        },
      });
    });

    source.setData({ type: 'FeatureCollection', features });

    if (features.length > 0) {
      previousMarkersRef.current = features;
    }
  }, [properties, clusters, hasTooManyResults, hoveredPropertyId]);

  // ✅ Log de errores
  if (error) {
    monitoring.error('[SearchMapMapboxV2] Error cargando tiles', {
      component: 'SearchMapMapboxV2',
      error,
      filters,
      bounds: viewportBounds,
    });
  }

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={mapContainer} className="absolute inset-0" />

      {/* 🔄 Overlay de carga */}
      {isLoading && viewportBounds && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/20 backdrop-blur-[2px]">
          <div className="rounded-lg bg-background/95 px-4 py-3 shadow-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Cargando propiedades en el mapa...</span>
            </div>
          </div>
        </div>
      )}

      {/* ❌ Overlay de error crítico */}
      {mapError && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/30 backdrop-blur-sm">
          <div className="pointer-events-auto rounded-lg bg-background border border-destructive/20 px-6 py-4 shadow-xl max-w-sm">
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <div>
                <p className="font-medium text-foreground">No pudimos cargar el mapa</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Configura VITE_MAPBOX_ACCESS_TOKEN en Lovable Cloud Secrets.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setMapError(null);
                  window.location.reload();
                }}
                className="mt-2"
              >
                Reintentar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ Overlay de tile saturado */}
      {hasTooManyResults && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-background/90 px-4 py-2 text-sm text-muted-foreground shadow-lg backdrop-blur-sm flex items-center gap-2">
            <ZoomIn className="h-4 w-4" />
            <span>Acerca el mapa para ver propiedades individuales</span>
          </div>
        </div>
      )}

      {/* ℹ️ Mensaje de zoom bajo */}
      {viewportBounds && viewportBounds.zoom < MIN_ZOOM_FOR_TILES && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-background/90 px-4 py-2 text-sm text-muted-foreground shadow-lg backdrop-blur-sm">
            Acerca un poco más el mapa para ver propiedades.
          </div>
        </div>
      )}
    </div>
  );
};
