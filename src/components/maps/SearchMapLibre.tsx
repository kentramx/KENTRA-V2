/**
 * KENTRA MAP STACK - MAPLIBRE VERSION
 * Mapa de búsqueda enterprise con MapLibre GL
 *
 * BENEFICIOS:
 * - $0/mes (vs $200-500 Google Maps)
 * - WebGL nativo (mejor performance)
 * - Sin límites de uso
 * - Clustering nativo
 * - Soporte para 1M+ propiedades
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { MapLibreBase } from './MapLibreBase';
import { MapLibreClusterLayer } from './MapLibreClusterLayer';
import { MapLibreMarkerLayer } from './MapLibreMarkerLayer';
import type { MapViewport, PropertyMarker, PropertyCluster } from '@/types/map';
import { Loader2, MapPin, ZoomIn, Expand } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MAPLIBRE_CONFIG } from '@/config/mapLibre';

interface SearchMapLibreProps {
  // Datos del mapa
  properties: PropertyMarker[];
  clusters: PropertyCluster[];
  totalCount: number;
  isClustered: boolean;

  // Estados de carga
  isLoading: boolean;
  isIdle?: boolean;
  isFetching?: boolean;
  isPending?: boolean;

  // Configuración
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  height?: string;
  className?: string;

  // Estados de interacción
  selectedPropertyId?: string | null;
  hoveredPropertyId?: string | null;
  visitedPropertyIds?: Set<string>;

  // Auto-zoom
  fitToBounds?: boolean;
  onFitComplete?: () => void;

  // Búsqueda por ubicación
  searchLocation?: {
    center: { lat: number; lng: number };
    bounds?: { north: number; south: number; east: number; west: number };
    zoom?: number;
  } | null;
  onSearchLocationApplied?: () => void;

  // Callbacks
  onPropertyClick?: (id: string) => void;
  onPropertyHover?: (property: PropertyMarker | null) => void;
  onViewportChange?: (viewport: MapViewport) => void;
  onClusterClick?: (cluster: PropertyCluster) => void;
  onMapReady?: (map: maplibregl.Map) => void;
}

export function SearchMapLibre({
  properties,
  clusters,
  totalCount,
  isClustered,
  isLoading,
  isIdle = false,
  isFetching = false,
  isPending = false,
  initialCenter,
  initialZoom = 12,
  height = '100%',
  className,
  selectedPropertyId,
  hoveredPropertyId,
  visitedPropertyIds = new Set(),
  fitToBounds = false,
  onFitComplete,
  searchLocation,
  onSearchLocationApplied,
  onPropertyClick,
  onPropertyHover,
  onViewportChange,
  onClusterClick,
  onMapReady: onMapReadyProp,
}: SearchMapLibreProps) {
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const fitBoundsExecutedRef = useRef(false);
  const hasLoadedOnce = useRef(false);

  // Cache de datos para evitar flickering
  const [cachedProperties, setCachedProperties] = useState<PropertyMarker[]>([]);
  const [cachedClusters, setCachedClusters] = useState<PropertyCluster[]>([]);

  // Actualizar cache cuando hay datos válidos
  useEffect(() => {
    if (!isFetching) {
      if (properties.length > 0) {
        setCachedProperties(properties);
        hasLoadedOnce.current = true;
      }
      if (clusters.length > 0) {
        setCachedClusters(clusters);
        hasLoadedOnce.current = true;
      }
    }
  }, [properties, clusters, isFetching]);

  // Handler de viewport
  const handleViewportChange = useCallback(
    (newViewport: MapViewport) => {
      onViewportChange?.(newViewport);
    },
    [onViewportChange]
  );

  // Handler de mapa listo
  const handleMapReady = useCallback(
    (mapInstance: maplibregl.Map) => {
      setMap(mapInstance);
      onMapReadyProp?.(mapInstance);
    },
    [onMapReadyProp]
  );

  // Auto-zoom to results
  useEffect(() => {
    if (!map || !fitToBounds || isFetching || fitBoundsExecutedRef.current) return;

    const hasData = properties.length > 0 || clusters.length > 0;
    if (!hasData) return;

    // Calcular bounds
    const allPoints = [
      ...properties.map((p) => ({ lat: p.lat, lng: p.lng })),
      ...clusters.map((c) => ({ lat: c.lat, lng: c.lng })),
    ].filter((p) => p.lat && p.lng);

    if (allPoints.length === 0) return;

    fitBoundsExecutedRef.current = true;

    const lngs = allPoints.map((p) => p.lng);
    const lats = allPoints.map((p) => p.lat);

    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ];

    setTimeout(() => {
      map.fitBounds(bounds, {
        padding: { top: 60, right: 40, bottom: 40, left: 40 },
        duration: 500,
      });

      setTimeout(() => {
        onFitComplete?.();
      }, 600);
    }, 100);
  }, [map, fitToBounds, isFetching, properties, clusters, onFitComplete]);

  // Reset del flag cuando fitToBounds cambia a false
  useEffect(() => {
    if (!fitToBounds) {
      fitBoundsExecutedRef.current = false;
    }
  }, [fitToBounds]);

  // Búsqueda por ubicación
  useEffect(() => {
    if (!map || !searchLocation) return;

    if (searchLocation.bounds) {
      const { north, south, east, west } = searchLocation.bounds;
      map.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        {
          padding: { top: 60, right: 40, bottom: 40, left: 40 },
          duration: 500,
        }
      );
    } else {
      map.flyTo({
        center: [searchLocation.center.lng, searchLocation.center.lat],
        zoom: searchLocation.zoom || 12,
        duration: 500,
      });
    }

    setTimeout(() => {
      onSearchLocationApplied?.();
    }, 600);
  }, [map, searchLocation, onSearchLocationApplied]);

  // Handler de click en cluster
  const handleClusterClick = useCallback(
    (cluster: { id: string; lat: number; lng: number; count: number }) => {
      const fullCluster = clusters.find((c) => c.id === cluster.id) || {
        ...cluster,
        expansion_zoom: (map?.getZoom() || 10) + 2,
      };

      if (onClusterClick) {
        onClusterClick(fullCluster as PropertyCluster);
      } else if (map) {
        const targetZoom = Math.min(fullCluster.expansion_zoom || map.getZoom() + 2, 16);
        map.flyTo({
          center: [cluster.lng, cluster.lat],
          zoom: targetZoom,
          duration: 500,
        });
      }
    },
    [map, clusters, onClusterClick]
  );

  // Datos a mostrar (con cache para evitar flickering)
  const displayProperties = useMemo(() => {
    if (isClustered) return [];
    return properties.length > 0 ? properties : cachedProperties;
  }, [properties, cachedProperties, isClustered]);

  const displayClusters = useMemo(() => {
    if (!isClustered) return [];
    const clusterData = clusters.length > 0 ? clusters : cachedClusters;
    return clusterData.map((c) => ({
      id: c.id,
      lat: c.lat,
      lng: c.lng,
      count: c.count,
      avg_price: undefined, // TODO: agregar si está disponible
    }));
  }, [clusters, cachedClusters, isClustered]);

  // Contador formateado
  const countDisplay = useMemo(() => {
    const count = totalCount || 0;
    if (count === 0) return '0';
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K`;
    }
    return count.toLocaleString();
  }, [totalCount]);

  return (
    <div
      data-map-container
      className={cn('relative w-full', className)}
      style={{ height }}
    >
      <MapLibreBase
        onViewportChange={handleViewportChange}
        onMapReady={handleMapReady}
        initialCenter={initialCenter}
        initialZoom={initialZoom}
        height="100%"
      >
        {/* Capa de clusters */}
        <MapLibreClusterLayer
          clusters={displayClusters}
          onClusterClick={handleClusterClick}
        />

        {/* Capa de markers de precio */}
        <MapLibreMarkerLayer
          properties={displayProperties}
          selectedPropertyId={selectedPropertyId}
          hoveredPropertyId={hoveredPropertyId}
          visitedPropertyIds={visitedPropertyIds}
          onPropertyClick={onPropertyClick}
          onPropertyHover={onPropertyHover}
          maxVisible={MAPLIBRE_CONFIG.clustering.maxMarkersPerViewport}
        />
      </MapLibreBase>

      {/* Badge de conteo */}
      <div className="absolute top-3 left-3 z-10">
        <Badge
          variant="secondary"
          className={cn(
            'bg-background/95 backdrop-blur-sm shadow-lg',
            'px-3 py-1.5 text-sm',
            'border border-border',
            'transition-all duration-200'
          )}
        >
          {(isLoading || isIdle || isPending) && !hasLoadedOnce.current ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 text-primary animate-spin" />
              <span className="text-muted-foreground font-normal">
                Buscando propiedades...
              </span>
            </>
          ) : (
            <>
              <MapPin className="h-3.5 w-3.5 mr-1.5 text-primary" />
              <span className="font-bold text-foreground">{countDisplay}</span>
              <span className="ml-1 text-muted-foreground font-normal">
                en esta área
              </span>
            </>
          )}
        </Badge>
      </div>

      {/* Botón fullscreen móvil */}
      <div className="absolute top-3 right-3 z-10 md:hidden">
        <Button
          variant="secondary"
          size="icon"
          className="h-11 w-11 bg-background/95 backdrop-blur-sm shadow-lg"
          aria-label="Ver mapa en pantalla completa"
          onClick={() => {
            const mapContainer = document.querySelector('[data-map-container]');
            if (mapContainer?.requestFullscreen) {
              mapContainer.requestFullscreen();
            }
          }}
        >
          <Expand className="h-4 w-4" />
        </Button>
      </div>

      {/* Indicador de carga inicial */}
      {(isLoading || isIdle || isPending) && !hasLoadedOnce.current && (
        <div className="absolute top-3 right-16 z-10 md:right-3">
          <Badge
            variant="outline"
            className="bg-background/95 backdrop-blur-sm shadow-sm border-border"
          >
            <Loader2 className="h-3 w-3 animate-spin mr-1.5 text-primary" />
            <span className="text-xs text-muted-foreground">Cargando...</span>
          </Badge>
        </div>
      )}

      {/* Indicador de modo cluster */}
      {isClustered && totalCount > 0 && !isLoading && (
        <div className="absolute bottom-3 left-3 z-10">
          <Badge
            variant="outline"
            className={cn(
              'bg-background/90 backdrop-blur-sm',
              'border-border shadow-sm',
              'px-2.5 py-1'
            )}
          >
            <ZoomIn className="h-3 w-3 mr-1.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Haz zoom para ver precios
            </span>
          </Badge>
        </div>
      )}

      {/* Estado vacío */}
      {!isLoading &&
        !isIdle &&
        !isPending &&
        hasLoadedOnce.current &&
        totalCount === 0 && (
          <div className="absolute bottom-3 left-3 z-10">
            <Badge
              variant="outline"
              className="bg-amber-50/95 border-amber-200 text-amber-700 dark:bg-amber-950/95 dark:border-amber-800 dark:text-amber-300"
            >
              <span className="text-xs">No hay propiedades en esta área</span>
            </Badge>
          </div>
        )}
    </div>
  );
}
