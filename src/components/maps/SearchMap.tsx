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
import { Loader2, MapPin, ZoomIn } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SearchMapProps {
  // Datos del mapa
  properties: PropertyMarker[];
  clusters: PropertyCluster[];
  totalCount: number;
  isClustered: boolean;
  
  // Estados de carga
  isLoading: boolean;
  isFetching?: boolean;
  
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
  
  // Callbacks
  onPropertyClick?: (id: string) => void;
  onPropertyHover?: (property: PropertyMarker | null) => void;
  onViewportChange?: (viewport: MapViewport) => void;
  onClusterClick?: (cluster: PropertyCluster) => void;
  onMapReady?: (map: google.maps.Map) => void;
}

// Límite de markers para rendimiento óptimo
const MAX_VISIBLE_MARKERS = 200;

export function SearchMap({
  properties,
  clusters,
  totalCount,
  isClustered,
  isLoading,
  isFetching = false,
  initialCenter,
  initialZoom = 12,
  height = '100%',
  className,
  selectedPropertyId,
  hoveredPropertyId,
  visitedPropertyIds = new Set(),
  fitToBounds = false,
  onFitComplete,
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

  // Handler de click en cluster - zoom suave animado
  const handleClusterClick = useCallback((cluster: PropertyCluster) => {
    if (onClusterClick) {
      onClusterClick(cluster);
    } else if (map) {
      map.panTo({ lat: cluster.lat, lng: cluster.lng });
      setTimeout(() => {
        map.setZoom(cluster.expansion_zoom);
      }, 200);
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
    cachedProperties.forEach(p => combined.set(p.id, p));
    properties.forEach(p => combined.set(p.id, p));
    return Array.from(combined.values()).slice(0, MAX_VISIBLE_MARKERS * 2);
  }, [properties, cachedProperties]);

  const allClusters = useMemo(() => {
    const combined = new Map<string, PropertyCluster>();
    cachedClusters.forEach(c => combined.set(c.id, c));
    clusters.forEach(c => combined.set(c.id, c));
    return Array.from(combined.values());
  }, [clusters, cachedClusters]);

  // Formatear contador elegante
  const countDisplay = useMemo(() => {
    if (totalCount === 0) return '0';
    if (totalCount >= 1000000) {
      return `${(totalCount / 1000000).toFixed(1)}M`;
    }
    if (totalCount >= 1000) {
      return `${(totalCount / 1000).toFixed(totalCount >= 10000 ? 0 : 1)}K`;
    }
    return totalCount.toLocaleString();
  }, [totalCount]);

  return (
    <div className={cn('relative w-full', className)} style={{ height }}>
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
          <MapPin className="h-3.5 w-3.5 mr-1.5 text-primary" />
          <span className="font-bold text-foreground">{countDisplay}</span>
          <span className="ml-1 text-muted-foreground font-normal">
            {totalCount === 1 ? 'propiedad' : 'propiedades'}
          </span>
        </Badge>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          INDICADOR DE CARGA - Solo en carga inicial (no en navegación)
          ═══════════════════════════════════════════════════════════ */}
      {isLoading && !hasLoadedOnce.current && (
        <div className="absolute top-3 right-3 z-10">
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

      {/* ═══════════════════════════════════════════════════════════
          ESTADO VACÍO - Cuando no hay propiedades
          ═══════════════════════════════════════════════════════════ */}
      {!isLoading && totalCount === 0 && (
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
