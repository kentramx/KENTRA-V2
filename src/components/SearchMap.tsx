/**
 * SearchMap - Mapa de búsqueda de propiedades con Mapbox
 * 
 * Este componente:
 * - Renderiza clusters y propiedades individuales
 * - Se sincroniza con useMapSearch / useTiledMap
 * - Maneja hover, click y navegación
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { MapboxBaseMap } from '@/components/MapboxBaseMap';
import type { ViewportBounds } from '@/hooks/useMapSearch';
import { mapboxgl, MAPBOX_TOKEN } from '@/lib/mapboxClient';
import type { MapProperty, PropertyCluster } from '@/types/property';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const CLUSTER_ZOOM_THRESHOLD = 13;

export interface SearchMapProps {
  properties: MapProperty[];
  clusters: PropertyCluster[];
  viewportBounds?: ViewportBounds | null;
  isLoading?: boolean;
  centerOnCoordinates?: { lat: number; lng: number } | null;
  onBoundsChange?: (bounds: ViewportBounds) => void;
  onPropertyHover?: (propertyId: string | null) => void;
  onPropertyClick?: (propertyId: string) => void;
  onClusterClick?: (center: { lat: number; lng: number }, zoom: number) => void;
  onMapError?: (message: string) => void;
  hoveredPropertyId?: string | null;
  className?: string;
}

/**
 * Formatea precio para mostrar en marker
 */
const formatMarkerPrice = (price: number, currency: string = 'MXN'): string => {
  if (price >= 1000000) {
    return `$${(price / 1000000).toFixed(1)}M`;
  }
  if (price >= 1000) {
    return `$${(price / 1000).toFixed(0)}K`;
  }
  return `$${price.toLocaleString('es-MX')}`;
};

export const SearchMap: React.FC<SearchMapProps> = ({
  properties,
  clusters,
  viewportBounds,
  isLoading = false,
  centerOnCoordinates,
  onBoundsChange,
  onPropertyHover,
  onPropertyClick,
  onClusterClick,
  onMapError,
  hoveredPropertyId,
  className,
}) => {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const clustersRef = useRef<mapboxgl.Marker[]>([]);
  const [currentZoom, setCurrentZoom] = useState(10);

  // Limpiar todos los markers
  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    clustersRef.current.forEach((c) => c.remove());
    clustersRef.current = [];
  }, []);

  // Callback cuando el mapa está listo
  const handleMapReady = useCallback((map: mapboxgl.Map) => {
    mapRef.current = map;
    setCurrentZoom(map.getZoom());

    // Escuchar cambios de zoom para actualizar markers
    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
    });
  }, []);

  // Renderizar markers cuando cambian properties/clusters o zoom
  useEffect(() => {
    if (!mapRef.current || !MAPBOX_TOKEN) return;

    // Limpiar markers anteriores
    clearMarkers();

    const map = mapRef.current;
    const zoom = currentZoom;

    // Renderizar clusters
    clusters.forEach((cluster) => {
      if (!cluster.lat || !cluster.lng) return;

      const el = document.createElement('div');
      el.className = 'custom-price-marker';
      
      // Tamaño basado en cantidad de propiedades
      const count = cluster.property_count || 0;
      if (count >= 50) {
        el.style.minWidth = '48px';
        el.style.minHeight = '48px';
        el.style.fontSize = '14px';
      } else if (count >= 20) {
        el.style.minWidth = '40px';
        el.style.minHeight = '40px';
        el.style.fontSize = '13px';
      } else {
        el.style.minWidth = '32px';
        el.style.minHeight = '32px';
        el.style.fontSize = '12px';
      }
      
      el.textContent = count.toString();

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const nextZoom = Math.min(zoom + 2, 18);
        map.easeTo({
          center: [cluster.lng, cluster.lat],
          zoom: nextZoom,
          duration: 500,
        });
        onClusterClick?.({ lat: cluster.lat, lng: cluster.lng }, nextZoom);
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([cluster.lng, cluster.lat])
        .addTo(map);

      clustersRef.current.push(marker);
    });

    // Renderizar propiedades individuales solo en zoom alto
    if (zoom >= CLUSTER_ZOOM_THRESHOLD) {
      properties.forEach((property) => {
        if (!property.lat || !property.lng) return;

        const el = document.createElement('div');
        el.className = 'marker-price-label';
        el.textContent = formatMarkerPrice(property.price, property.currency);

        // Highlight si es la propiedad hovered
        if (hoveredPropertyId === property.id) {
          el.style.background = 'hsl(var(--primary))';
          el.style.color = 'hsl(var(--primary-foreground))';
          el.style.transform = 'scale(1.1)';
          el.style.zIndex = '1000';
        }

        el.addEventListener('mouseenter', () => {
          onPropertyHover?.(property.id);
        });

        el.addEventListener('mouseleave', () => {
          onPropertyHover?.(null);
        });

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onPropertyClick?.(property.id);
        });

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([property.lng, property.lat])
          .addTo(map);

        markersRef.current.push(marker);
      });
    }

    // Cleanup
    return () => {
      clearMarkers();
    };
  }, [properties, clusters, currentZoom, hoveredPropertyId, onPropertyClick, onPropertyHover, onClusterClick, clearMarkers]);

  // Recentrar cuando centerOnCoordinates cambia
  useEffect(() => {
    if (!mapRef.current || !centerOnCoordinates) return;

    mapRef.current.easeTo({
      center: [centerOnCoordinates.lng, centerOnCoordinates.lat],
      zoom: Math.max(mapRef.current.getZoom(), 14),
      duration: 500,
    });
  }, [centerOnCoordinates?.lat, centerOnCoordinates?.lng]);

  // Centro inicial basado en primera propiedad/cluster o CDMX
  const initialCenter = properties[0]
    ? { lat: properties[0].lat, lng: properties[0].lng }
    : clusters[0]
    ? { lat: clusters[0].lat, lng: clusters[0].lng }
    : centerOnCoordinates || { lat: 19.4326, lng: -99.1332 };

  return (
    <div className={cn("relative h-full w-full", className)}>
      <MapboxBaseMap
        initialCenter={initialCenter}
        initialZoom={10}
        onBoundsChange={onBoundsChange}
        onMapReady={handleMapReady}
        className="h-full w-full"
      />

      {/* Indicador de carga */}
      {isLoading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-background/90 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-2 shadow-md border">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Cargando...</span>
          </div>
        </div>
      )}

      {/* Contador de propiedades */}
      <div className="absolute bottom-4 left-4 z-10">
        <div className="bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md border">
          <p className="text-sm font-medium">
            {properties.length + clusters.reduce((acc, c) => acc + (c.property_count || 0), 0)} propiedades
          </p>
          {currentZoom < CLUSTER_ZOOM_THRESHOLD && (
            <p className="text-xs text-muted-foreground">
              Acerca para ver detalles
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchMap;
