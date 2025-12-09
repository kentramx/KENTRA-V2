/**
 * MapboxBaseMap - Componente base genérico para mapas Mapbox
 * 
 * Este componente NO sabe nada de propiedades, solo maneja:
 * - Centro y zoom inicial
 * - Eventos de movimiento
 * - Bounds + zoom reportados hacia afuera
 */

import React, { useRef, useEffect, useState } from 'react';
import { mapboxgl, MAPBOX_TOKEN } from '@/lib/mapboxClient';
import { cn } from '@/lib/utils';

import type { ViewportBounds } from '@/hooks/useMapSearch';

export interface MapboxBaseMapProps {
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  onBoundsChange?: (bounds: ViewportBounds) => void;
  onMapReady?: (map: mapboxgl.Map) => void;
  className?: string;
  children?: React.ReactNode;
}

const DEFAULT_CENTER = { lat: 19.4326, lng: -99.1332 }; // CDMX
const DEFAULT_ZOOM = 10;
const DEBOUNCE_MS = 200;

export const MapboxBaseMap: React.FC<MapboxBaseMapProps> = ({
  initialCenter = DEFAULT_CENTER,
  initialZoom = DEFAULT_ZOOM,
  onBoundsChange,
  onMapReady,
  className,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const moveTimeoutRef = useRef<number | undefined>(undefined);
  const [mapReady, setMapReady] = useState(false);

  // Debug: log del token en cada render
  console.log('[MapboxBaseMap] Render check:', {
    hasToken: !!MAPBOX_TOKEN,
    tokenLength: MAPBOX_TOKEN?.length || 0,
    tokenPrefix: MAPBOX_TOKEN?.substring(0, 10) || 'N/A',
  });

  useEffect(() => {
    console.log('[MapboxBaseMap] useEffect check:', {
      hasContainer: !!containerRef.current,
      hasExistingMap: !!mapRef.current,
      hasToken: !!MAPBOX_TOKEN,
    });
    
    // No crear mapa si ya existe, no hay contenedor, o no hay token
    if (mapRef.current || !containerRef.current || !MAPBOX_TOKEN) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [initialCenter.lng, initialCenter.lat],
      zoom: initialZoom,
    });

    mapRef.current = map;

    // Esperar a que el mapa esté listo
    map.on("load", () => {
      setMapReady(true);
      onMapReady?.(map);

      // Reportar bounds iniciales
      if (onBoundsChange) {
        const bounds = map.getBounds();
        const zoom = map.getZoom();
        onBoundsChange({
          minLng: bounds.getWest(),
          maxLng: bounds.getEast(),
          minLat: bounds.getSouth(),
          maxLat: bounds.getNorth(),
          zoom,
        });
      }
    });

    // Evento de movimiento con debounce
    if (onBoundsChange) {
      const handleMoveEnd = () => {
        if (!mapRef.current) return;

        if (moveTimeoutRef.current !== undefined) {
          window.clearTimeout(moveTimeoutRef.current);
        }

        moveTimeoutRef.current = window.setTimeout(() => {
          if (!mapRef.current) return;
          const bounds = mapRef.current.getBounds();
          const zoom = mapRef.current.getZoom();

          onBoundsChange({
            minLng: bounds.getWest(),
            maxLng: bounds.getEast(),
            minLat: bounds.getSouth(),
            maxLat: bounds.getNorth(),
            zoom,
          });
        }, DEBOUNCE_MS);
      };

      map.on("moveend", handleMoveEnd);
    }

    // Agregar controles de navegación
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Cleanup
    return () => {
      if (moveTimeoutRef.current !== undefined) {
        window.clearTimeout(moveTimeoutRef.current);
      }
      map.remove();
      mapRef.current = null;
    };
  }, []); // Solo ejecutar una vez al montar

  // Actualizar centro si cambia (flyTo suave)
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const currentCenter = mapRef.current.getCenter();
    const threshold = 0.001; // ~111 metros

    if (
      Math.abs(currentCenter.lat - initialCenter.lat) > threshold ||
      Math.abs(currentCenter.lng - initialCenter.lng) > threshold
    ) {
      mapRef.current.easeTo({
        center: [initialCenter.lng, initialCenter.lat],
        zoom: Math.max(mapRef.current.getZoom(), initialZoom),
        duration: 500,
      });
    }
  }, [initialCenter.lat, initialCenter.lng, mapReady]);

  // Mostrar error si no hay token
  if (!MAPBOX_TOKEN) {
    return (
      <div className={cn("relative h-full w-full", className)}>
        <div className="absolute inset-0 flex items-center justify-center bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground text-center px-4">
            Mapa no disponible. Falta configurar VITE_MAPBOX_ACCESS_TOKEN.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative h-full w-full", className)}>
      <div
        ref={containerRef}
        className="h-full w-full rounded-lg overflow-hidden"
      />
      {children}
    </div>
  );
};

export default MapboxBaseMap;
