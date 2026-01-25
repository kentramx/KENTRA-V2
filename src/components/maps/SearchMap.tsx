/**
 * KENTRA MAP STACK - OFICIAL
 * Mapa de búsqueda premium
 * - Renderiza clusters O markers según modo (nunca ambos)
 * - Optimizado para millones de propiedades
 * - Cache de markers para evitar flickering
 * - Transiciones suaves
 * - Indicadores de estado
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { GoogleMapBase } from './GoogleMapBase';
import { PriceMarker } from './PriceMarker';
import { ClusterMarker } from './ClusterMarker';
import type { MapViewport, PropertyMarker, PropertyCluster } from '@/types/map';
import { Loader2, MapPin, ZoomIn, Expand } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SearchMapProps {
  // Datos del mapa
  properties: PropertyMarker[];
  clusters: PropertyCluster[];
  totalCount: number;
  isClustered: boolean;

  // Estados de carga
  isLoading: boolean;
  isIdle?: boolean; // Query deshabilitado (esperando viewport válido)
  isFetching?: boolean;
  isPending?: boolean; // Viewport esperando debounce

  // Configuración
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  height?: string;
  className?: string;

  // Estados de interacción
  selectedPropertyId?: string | null;
  hoveredPropertyId?: string | null;
  visitedPropertyIds?: Set<string>;

  // Auto-zoom to results
  fitToBounds?: boolean;
  onFitComplete?: () => void;

  // Búsqueda por ubicación
  searchLocation?: {
    center: { lat: number; lng: number };
    bounds?: google.maps.LatLngBounds;
    zoom?: number;
  } | null;
  onSearchLocationApplied?: () => void;

  // Callbacks
  onPropertyClick?: (id: string) => void;
  onPropertyHover?: (property: PropertyMarker | null) => void;
  onViewportChange?: (viewport: MapViewport) => void;
  onClusterClick?: (cluster: PropertyCluster) => void;
  onMapReady?: (map: google.maps.Map) => void;
}

// Límite de markers para rendimiento óptimo
const MAX_VISIBLE_MARKERS = 200;
// Límite de cache para evitar memory leaks durante navegación extendida
const MAX_CACHED_PROPERTIES = 500;
const MAX_CACHED_CLUSTERS = 200;

export function SearchMap({
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
}: SearchMapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const fitBoundsExecutedRef = useRef(false);
  
  // ═══════════════════════════════════════════════════════════
  // POOL DE MARKERS - Evita flickering manteniendo markers montados
  // Solo cambia visibilidad con CSS, nunca desmonta
  // ═══════════════════════════════════════════════════════════
  const [cachedProperties, setCachedProperties] = useState<PropertyMarker[]>([]);
  const [cachedClusters, setCachedClusters] = useState<PropertyCluster[]>([]);
  const hasLoadedOnce = useRef(false);
  
  // Actualizar cache cuando hay datos válidos (con límite de tamaño)
  useEffect(() => {
    if (!isFetching) {
      if (properties.length > 0) {
        setCachedProperties(prev => {
          // Merge new properties with cache, keeping most recent
          const combined = new Map<string, PropertyMarker>();
          // Add previous (oldest first, will be overwritten)
          prev.slice(-MAX_CACHED_PROPERTIES / 2).forEach(p => combined.set(p.id, p));
          // Add current (newest, will overwrite duplicates)
          properties.forEach(p => combined.set(p.id, p));
          // Limit total size
          return Array.from(combined.values()).slice(-MAX_CACHED_PROPERTIES);
        });
        hasLoadedOnce.current = true;
      }
      if (clusters.length > 0) {
        setCachedClusters(prev => {
          // Merge new clusters with cache, keeping most recent
          const combined = new Map<string, PropertyCluster>();
          prev.slice(-MAX_CACHED_CLUSTERS / 2).forEach(c => combined.set(c.id, c));
          clusters.forEach(c => combined.set(c.id, c));
          return Array.from(combined.values()).slice(-MAX_CACHED_CLUSTERS);
        });
        hasLoadedOnce.current = true;
      }
    }
  }, [properties, clusters, isFetching]);

  // Handler de viewport
  const handleViewportChange = useCallback((newViewport: MapViewport) => {
    onViewportChange?.(newViewport);
  }, [onViewportChange]);

  // Handler de mapa listo
  const handleMapReady = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
    onMapReadyProp?.(mapInstance);
  }, [onMapReadyProp]);

  // ═══════════════════════════════════════════════════════════
  // AUTO-ZOOM TO RESULTS (Fit to Bounds)
  // Ejecuta fitBounds cuando hay datos FILTRADOS y no está cargando
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    // Condiciones para ejecutar fitBounds:
    // 1. Hay mapa disponible
    // 2. fitToBounds está activo
    // 3. NO está cargando (datos frescos ya llegaron)
    // 4. No se ha ejecutado ya para este ciclo
    // 5. Hay propiedades o clusters para ajustar
    if (!map || !fitToBounds || isFetching || fitBoundsExecutedRef.current) return;
    
    const hasData = properties.length > 0 || clusters.length > 0;
    if (!hasData) return;

    // Calcular bounds de todas las propiedades Y clusters
    const bounds = new google.maps.LatLngBounds();
    let pointsAdded = 0;

    // Agregar propiedades
    properties.forEach(p => {
      if (p.lat && p.lng) {
        bounds.extend({ lat: p.lat, lng: p.lng });
        pointsAdded++;
      }
    });

    // Agregar clusters
    clusters.forEach(c => {
      if (c.lat && c.lng) {
        bounds.extend({ lat: c.lat, lng: c.lng });
        pointsAdded++;
      }
    });

    // Solo ejecutar si hay puntos válidos
    if (pointsAdded === 0) return;

    // Marcar como ejecutado ANTES de la animación para evitar re-ejecuciones
    fitBoundsExecutedRef.current = true;

    // Ejecutar fitBounds con padding para que no queden pegados al borde
    // Usar setTimeout para permitir que el mapa termine su renderizado inicial
    setTimeout(() => {
      map.fitBounds(bounds, {
        top: 60,
        right: 40,
        bottom: 40,
        left: 40,
      });

      // Notificar que el fit se completó después de la animación
      setTimeout(() => {
        onFitComplete?.();
      }, 500); // Esperar animación de Google Maps (~400ms)
    }, 100);

  }, [map, fitToBounds, isFetching, properties, clusters, onFitComplete]);

  // Reset del flag cuando fitToBounds cambia a false
  useEffect(() => {
    if (!fitToBounds) {
      fitBoundsExecutedRef.current = false;
    }
  }, [fitToBounds]);

  // ═══════════════════════════════════════════════════════════
  // BÚSQUEDA POR UBICACIÓN - Pan/Zoom a ubicación buscada
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (!map || !searchLocation) return;

    // Si hay bounds específicos del lugar, usarlos
    if (searchLocation.bounds) {
      map.fitBounds(searchLocation.bounds, {
        top: 60,
        right: 40,
        bottom: 40,
        left: 40,
      });
    } else {
      // Si no hay bounds, usar center + zoom
      map.panTo(searchLocation.center);
      if (searchLocation.zoom) {
        setTimeout(() => {
          map.setZoom(searchLocation.zoom!);
        }, 150);
      } else {
        // Zoom por defecto para búsquedas: 12 (nivel de ciudad)
        setTimeout(() => {
          map.setZoom(12);
        }, 150);
      }
    }

    // Notificar que se aplicó la búsqueda
    setTimeout(() => {
      onSearchLocationApplied?.();
    }, 500);
  }, [map, searchLocation, onSearchLocationApplied]);

  // Handler de click en cluster - zoom suave animado estilo Zillow
  const handleClusterClick = useCallback((cluster: PropertyCluster) => {
    if (onClusterClick) {
      onClusterClick(cluster);
    } else if (map) {
      const currentZoom = map.getZoom() || 5;
      const targetZoom = Math.min(cluster.expansion_zoom, 16);

      // Smooth zoom animation - primero pan, luego zoom gradual
      map.panTo({ lat: cluster.lat, lng: cluster.lng });

      // Zoom progresivo para transición más suave
      const zoomSteps = Math.abs(targetZoom - currentZoom);
      if (zoomSteps <= 2) {
        // Zoom directo si es poco cambio
        setTimeout(() => map.setZoom(targetZoom), 150);
      } else {
        // Zoom en pasos para cambios grandes
        let step = 0;
        const stepZoom = () => {
          step++;
          const progress = step / 2;
          const newZoom = Math.round(currentZoom + (targetZoom - currentZoom) * Math.min(progress, 1));
          map.setZoom(newZoom);
          if (step < 2) {
            setTimeout(stepZoom, 120);
          }
        };
        setTimeout(stepZoom, 150);
      }
    }
  }, [map, onClusterClick]);

  // ═══════════════════════════════════════════════════════════
  // SETS DE IDs VISIBLES - O(1) lookup para determinar visibilidad
  // ═══════════════════════════════════════════════════════════
  const visiblePropertyIds = useMemo(() => {
    if (isClustered) return new Set<string>();
    const source = properties.length > 0 ? properties : cachedProperties;
    return new Set(source.slice(0, MAX_VISIBLE_MARKERS).map(p => p.id));
  }, [properties, cachedProperties, isClustered]);

  const visibleClusterIds = useMemo(() => {
    if (!isClustered) return new Set<string>();
    const source = clusters.length > 0 ? clusters : cachedClusters;
    return new Set(source.map(c => c.id));
  }, [clusters, cachedClusters, isClustered]);

  // ═══════════════════════════════════════════════════════════
  // POOL COMBINADO - Mantiene todos los markers montados
  // ═══════════════════════════════════════════════════════════
  const allProperties = useMemo(() => {
    const combined = new Map<string, PropertyMarker>();
    // Prioritize current properties over cached
    cachedProperties.forEach(p => combined.set(p.id, p));
    properties.forEach(p => combined.set(p.id, p));
    // Limit to prevent memory bloat
    return Array.from(combined.values()).slice(0, MAX_CACHED_PROPERTIES);
  }, [properties, cachedProperties]);

  const allClusters = useMemo(() => {
    const combined = new Map<string, PropertyCluster>();
    cachedClusters.forEach(c => combined.set(c.id, c));
    clusters.forEach(c => combined.set(c.id, c));
    // Limit to prevent memory bloat
    return Array.from(combined.values()).slice(0, MAX_CACHED_CLUSTERS);
  }, [clusters, cachedClusters]);

  // ═══════════════════════════════════════════════════════════
  // CONTADOR DE PROPIEDADES EN ESTA ÁREA
  // Usa totalCount que viene sincronizado con la lista
  // ═══════════════════════════════════════════════════════════
  const visibleCount = useMemo(() => {
    // Siempre usar totalCount si está disponible (viene de property-search)
    // Esto asegura que mapa y lista muestren el mismo número
    return totalCount || 0;
  }, [totalCount]);

  // Formatear contador elegante
  const countDisplay = useMemo(() => {
    const count = visibleCount;
    if (count === 0) return '0';
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K`;
    }
    return count.toLocaleString();
  }, [visibleCount]);

  return (
    <div data-map-container className={cn('relative w-full', className)} style={{ height }}>
      <GoogleMapBase
        onViewportChange={handleViewportChange}
        onMapReady={handleMapReady}
        initialCenter={initialCenter}
        initialZoom={initialZoom}
        height="100%"
      >
        {/* ═══════════════════════════════════════════════════════════
            POOL DE CLUSTERS - Siempre montados, visibilidad por CSS
            ═══════════════════════════════════════════════════════════ */}
        {allClusters.map((cluster) => (
          <ClusterMarker
            key={cluster.id}
            map={map}
            cluster={cluster}
            onClick={handleClusterClick}
            hidden={!visibleClusterIds.has(cluster.id)}
          />
        ))}

        {/* ═══════════════════════════════════════════════════════════
            POOL DE PRICE MARKERS - Siempre montados, visibilidad por CSS
            ═══════════════════════════════════════════════════════════ */}
        {allProperties.map((property) => (
          <PriceMarker
            key={property.id}
            map={map}
            property={property}
            isSelected={property.id === selectedPropertyId}
            isHovered={property.id === hoveredPropertyId}
            isVisited={visitedPropertyIds.has(property.id)}
            onClick={onPropertyClick}
            onHover={onPropertyHover}
            hidden={!visiblePropertyIds.has(property.id)}
          />
        ))}
      </GoogleMapBase>

      {/* ═══════════════════════════════════════════════════════════
          BADGE DE CONTEO - Esquina superior izquierda
          ═══════════════════════════════════════════════════════════ */}
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
              <span className="text-muted-foreground font-normal">Buscando propiedades...</span>
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

      {/* ═══════════════════════════════════════════════════════════
          BOTÓN FULLSCREEN - Solo en móvil
          ═══════════════════════════════════════════════════════════ */}
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

      {/* ═══════════════════════════════════════════════════════════
          INDICADOR DE CARGA - Solo en carga inicial (no en navegación)
          ═══════════════════════════════════════════════════════════ */}
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

      {/* ═══════════════════════════════════════════════════════════
          INDICADOR DE MODO CLUSTER - Esquina inferior izquierda
          ═══════════════════════════════════════════════════════════ */}
      {isClustered && visibleCount > 0 && !isLoading && (
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

      {/* ═══════════════════════════════════════════════════════════
          ESTADO VACÍO - Cuando no hay propiedades
          ═══════════════════════════════════════════════════════════ */}
      {!isLoading && !isIdle && !isPending && hasLoadedOnce.current && visibleCount === 0 && (
        <div className="absolute bottom-3 left-3 z-10">
          <Badge 
            variant="outline" 
            className="bg-amber-50/95 border-amber-200 text-amber-700 dark:bg-amber-950/95 dark:border-amber-800 dark:text-amber-300"
          >
            <span className="text-xs">
              No hay propiedades en esta área
            </span>
          </Badge>
        </div>
      )}
    </div>
  );
}
