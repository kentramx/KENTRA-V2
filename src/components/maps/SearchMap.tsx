/**
 * KENTRA MAP STACK - OFICIAL
 * Mapa de búsqueda premium
 * - Renderiza clusters O markers según modo (nunca ambos)
 * - Optimizado para millones de propiedades
 * - Transiciones suaves
 * - Indicadores de estado
 */

import { useState, useCallback, useMemo } from 'react';
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
  
  // Callbacks
  onPropertyClick?: (id: string) => void;
  onPropertyHover?: (property: PropertyMarker | null) => void;
  onViewportChange?: (viewport: MapViewport) => void;
  onClusterClick?: (cluster: PropertyCluster) => void;
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
  onPropertyClick,
  onPropertyHover,
  onViewportChange,
  onClusterClick,
}: SearchMapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);

  // Handler de viewport
  const handleViewportChange = useCallback((newViewport: MapViewport) => {
    onViewportChange?.(newViewport);
  }, [onViewportChange]);

  // Handler de mapa listo
  const handleMapReady = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  // Handler de click en cluster - zoom suave animado
  const handleClusterClick = useCallback((cluster: PropertyCluster) => {
    if (onClusterClick) {
      onClusterClick(cluster);
    } else if (map) {
      // Primero pan, luego zoom para animación suave
      map.panTo({ lat: cluster.lat, lng: cluster.lng });
      setTimeout(() => {
        map.setZoom(cluster.expansion_zoom);
      }, 200);
    }
  }, [map, onClusterClick]);

  // IMPORTANTE: Solo mostrar markers si NO estamos en modo cluster
  const visibleProperties = useMemo(() => {
    if (isClustered) return []; // En modo cluster, NO mostrar markers individuales
    return properties.slice(0, MAX_VISIBLE_MARKERS);
  }, [properties, isClustered]);

  // IMPORTANTE: Solo mostrar clusters si ESTAMOS en modo cluster
  const visibleClusters = useMemo(() => {
    if (!isClustered) return []; // En modo markers, NO mostrar clusters
    return clusters;
  }, [clusters, isClustered]);

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
            CLUSTERS - Solo cuando isClustered es TRUE
            ═══════════════════════════════════════════════════════════ */}
        {visibleClusters.map((cluster) => (
          <ClusterMarker
            key={cluster.id}
            cluster={cluster}
            onClick={handleClusterClick}
          />
        ))}

        {/* ═══════════════════════════════════════════════════════════
            PRICE MARKERS - Solo cuando isClustered es FALSE
            ═══════════════════════════════════════════════════════════ */}
        {visibleProperties.map((property) => (
          <PriceMarker
            key={property.id}
            property={property}
            isSelected={property.id === selectedPropertyId}
            isHovered={property.id === hoveredPropertyId}
            isVisited={visitedPropertyIds.has(property.id)}
            onClick={onPropertyClick}
            onHover={onPropertyHover}
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
          INDICADOR DE CARGA - Esquina superior derecha
          ═══════════════════════════════════════════════════════════ */}
      {(isLoading || isFetching) && (
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
