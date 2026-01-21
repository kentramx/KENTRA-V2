/**
 * Custom OverlayView que NO recrea DOM al mover el mapa
 * KENTRA MAP STACK - OFICIAL
 * 
 * Soluciona el bug conocido de @react-google-maps/api OverlayView
 * que recrea el DOM interno en cada movimiento del mapa.
 * Ver: https://github.com/JustFly1984/react-google-maps-api/issues/198
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface StableOverlayProps {
  map: google.maps.Map | null;
  position: { lat: number; lng: number };
  children: React.ReactNode;
  zIndex?: number;
  hidden?: boolean;
}

export function StableOverlay({ 
  map, 
  position, 
  children, 
  zIndex = 20,
  hidden = false 
}: StableOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<google.maps.OverlayView | null>(null);
  const positionRef = useRef(position);
  const [isReady, setIsReady] = useState(false);

  // Actualizar ref de posición y redibujar
  useEffect(() => {
    positionRef.current = position;
    overlayRef.current?.draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- position object ref is intentionally excluded, using lat/lng values directly
  }, [position.lat, position.lng]);

  // Crear overlay UNA SOLA VEZ
  useEffect(() => {
    if (!map) return;

    // Crear container UNA VEZ
    if (!containerRef.current) {
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.willChange = 'transform';
      container.style.transition = 'opacity 150ms ease-out';
      containerRef.current = container;
    }

    // Crear overlay UNA VEZ
    if (!overlayRef.current) {
      const overlay = new google.maps.OverlayView();
      
      overlay.onAdd = function() {
        const pane = this.getPanes()?.overlayMouseTarget;
        if (pane && containerRef.current) {
          pane.appendChild(containerRef.current);
          setIsReady(true);
        }
      };

      overlay.draw = function() {
        const projection = this.getProjection();
        if (!projection || !containerRef.current) return;
        
        const pos = projection.fromLatLngToDivPixel(
          new google.maps.LatLng(positionRef.current.lat, positionRef.current.lng)
        );
        
        if (pos) {
          // Usar transform para mejor performance (GPU accelerated)
          containerRef.current.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
        }
      };

      overlay.onRemove = function() {
        if (containerRef.current?.parentNode) {
          containerRef.current.parentNode.removeChild(containerRef.current);
        }
      };

      overlay.setMap(map);
      overlayRef.current = overlay;
    }

    return () => {
      overlayRef.current?.setMap(null);
      overlayRef.current = null;
    };
  }, [map]);

  // Actualizar visibilidad con CSS (sin recrear DOM)
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.opacity = hidden ? '0' : '1';
      containerRef.current.style.pointerEvents = hidden ? 'none' : 'auto';
      containerRef.current.style.zIndex = String(hidden ? -1 : zIndex);
      containerRef.current.style.visibility = hidden ? 'hidden' : 'visible';
    }
  }, [hidden, zIndex]);

  // Renderizar con Portal al container persistente
  if (!isReady || !containerRef.current) return null;
  return createPortal(children, containerRef.current);
}
