/**
 * Componente base de MapLibre GL para Kentra
 *
 * RESPONSABILIDADES:
 * - Renderizar mapa con MapLibre GL (gratis, sin API key)
 * - Emitir eventos de viewport change
 * - Manejar estados de carga y error
 *
 * BENEFICIOS vs Google Maps:
 * - $0/mes (vs $200-500/mes)
 * - Sin límites de uso
 * - Open source
 * - WebGL nativo (mejor performance)
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import Map, {
  MapRef,
  ViewStateChangeEvent,
  MapLayerMouseEvent
} from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAPLIBRE_CONFIG } from '@/config/mapLibre';
import type { MapViewport } from '@/types/map';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MapLibreBaseProps {
  onViewportChange?: (viewport: MapViewport) => void;
  onMapReady?: (map: maplibregl.Map) => void;
  onClick?: (e: MapLayerMouseEvent) => void;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  height?: string;
  className?: string;
  children?: React.ReactNode;
}

export function MapLibreBase({
  onViewportChange,
  onMapReady,
  onClick,
  initialCenter = MAPLIBRE_CONFIG.defaultCenter,
  initialZoom = MAPLIBRE_CONFIG.zoom.default,
  height = '100%',
  className,
  children,
}: MapLibreBaseProps) {
  const mapRef = useRef<MapRef>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Viewport inicial
  const [viewState, setViewState] = useState({
    longitude: initialCenter.lng,
    latitude: initialCenter.lat,
    zoom: initialZoom,
  });

  // Emitir cambio de viewport (debounced)
  const emitViewport = useCallback(() => {
    if (!mapRef.current || !onViewportChange) return;

    const map = mapRef.current.getMap();
    const bounds = map.getBounds();
    const center = map.getCenter();
    const zoom = map.getZoom();

    if (!bounds) return;

    const viewport: MapViewport = {
      bounds: {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      },
      zoom: Math.floor(zoom),
      center: {
        lat: center.lat,
        lng: center.lng,
      },
    };

    onViewportChange(viewport);
  }, [onViewportChange]);

  // Handler para movimiento del mapa
  const handleMove = useCallback((evt: ViewStateChangeEvent) => {
    setViewState(evt.viewState);

    // Debounce viewport change
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      emitViewport();
    }, MAPLIBRE_CONFIG.debounce.boundsChange);
  }, [emitViewport]);

  // Handler cuando el mapa termina de cargar
  const handleLoad = useCallback(() => {
    setIsLoaded(true);

    if (mapRef.current && onMapReady) {
      onMapReady(mapRef.current.getMap());
    }

    // Emitir viewport inicial
    setTimeout(emitViewport, 100);
  }, [onMapReady, emitViewport]);

  // Handler para errores
  const handleError = useCallback((e: ErrorEvent) => {
    console.error('[MapLibreBase] Error:', e);
    setMapError('Error al cargar el mapa. Verifica tu conexión.');
  }, []);

  // Cleanup del debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // Estado de error
  if (mapError) {
    return (
      <div
        className={`flex items-center justify-center bg-muted ${className}`}
        style={{ height }}
      >
        <div className="text-center p-6 max-w-sm">
          <AlertCircle className="h-10 w-10 mx-auto mb-3 text-destructive" />
          <p className="font-medium mb-2">Error al cargar el mapa</p>
          <p className="text-sm text-muted-foreground mb-4">{mapError}</p>
          <Button
            variant="outline"
            onClick={() => {
              setMapError(null);
              window.location.reload();
            }}
          >
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{ height, position: 'relative' }}>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={handleMove}
        onLoad={handleLoad}
        onError={handleError}
        onClick={onClick}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAPLIBRE_CONFIG.defaultStyle}
        minZoom={MAPLIBRE_CONFIG.zoom.min}
        maxZoom={MAPLIBRE_CONFIG.zoom.max}
        maxBounds={[
          [MAPLIBRE_CONFIG.bounds.west, MAPLIBRE_CONFIG.bounds.south],
          [MAPLIBRE_CONFIG.bounds.east, MAPLIBRE_CONFIG.bounds.north],
        ]}
        attributionControl={true}
        // Optimizaciones de performance
        fadeDuration={0}
        trackResize={true}
      >
        {isLoaded && children}
      </Map>

      {/* Indicador de carga */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Cargando mapa...</span>
          </div>
        </div>
      )}
    </div>
  );
}
