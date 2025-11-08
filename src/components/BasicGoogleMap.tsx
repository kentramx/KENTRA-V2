/// <reference types="google.maps" />
import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/lib/loadGoogleMaps';
import { MarkerClusterer, GridAlgorithm } from '@googlemaps/markerclusterer';

type LatLng = { lat: number; lng: number };
type BasicMarker = LatLng & { id?: string };

interface BasicGoogleMapProps {
  center?: LatLng;
  zoom?: number;
  markers?: BasicMarker[];
  height?: number | string;
  className?: string;
  onReady?: (map: google.maps.Map) => void;
  enableClustering?: boolean;
}

export function BasicGoogleMap({
  center = { lat: 19.4326, lng: -99.1332 },
  zoom = 12,
  markers = [],
  height = 'calc(100vh - 8rem)',
  className,
  onReady,
  enableClustering = true,
}: BasicGoogleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRefs = useRef<google.maps.Marker[]>([]);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const waitForSize = async (el: HTMLElement, tries = 60, delayMs = 50) => {
    for (let i = 0; i < tries; i++) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return;
      await new Promise(r => setTimeout(r, delayMs));
    }
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        await loadGoogleMaps();
        if (!mounted || !containerRef.current) return;

        await waitForSize(containerRef.current);

        mapRef.current = new google.maps.Map(containerRef.current, {
          center,
          zoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        if (onReady && mapRef.current) onReady(mapRef.current);
      } catch (e: any) {
        setError(e?.message || 'No se pudo cargar el mapa');
      }
    };

    init();

    return () => {
      mounted = false;
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
        clustererRef.current = null;
      }
      markerRefs.current.forEach(m => m.setMap(null));
      markerRefs.current = [];
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Limpiar clusterer anterior si existe
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current = null;
    }

    // Limpiar marcadores anteriores
    markerRefs.current.forEach(m => m.setMap(null));
    markerRefs.current = [];

    if (!markers || markers.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    
    // Crear nuevos marcadores
    for (const m of markers) {
      if (typeof m.lat !== 'number' || typeof m.lng !== 'number') continue;
      
      const marker = new google.maps.Marker({ 
        position: { lat: m.lat, lng: m.lng },
      });
      
      markerRefs.current.push(marker);
      bounds.extend(marker.getPosition()!);
    }

    // Si clustering está habilitado, crear el clusterer
    if (enableClustering && markerRefs.current.length > 0) {
      clustererRef.current = new MarkerClusterer({
        map,
        markers: markerRefs.current,
        algorithm: new GridAlgorithm({ maxZoom: 15 }),
        renderer: {
          render: ({ count, position }) => {
            // Personalizar el aspecto del cluster
            const color = count > 50 ? '#e11d48' : count > 20 ? '#f97316' : count > 10 ? '#eab308' : '#0ea5e9';
            
            return new google.maps.Marker({
              position,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: color,
                fillOpacity: 0.8,
                strokeColor: '#ffffff',
                strokeWeight: 3,
                scale: Math.min(20 + count / 2, 35),
              },
              label: {
                text: String(count),
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 'bold',
              },
              zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count,
            });
          },
        },
      });
    } else {
      // Si clustering no está habilitado, agregar marcadores directamente al mapa
      markerRefs.current.forEach(marker => marker.setMap(map));
    }

    // Ajustar vista del mapa a los marcadores
    if (markerRefs.current.length > 1) {
      map.fitBounds(bounds);
    } else if (markerRefs.current.length === 1) {
      map.setCenter(markerRefs.current[0].getPosition()!);
    }
  }, [markers, enableClustering]);

  // Centrar el mapa cuando cambie la prop center
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;
    
    map.panTo(center);
    // Ajustar zoom si está muy alejado
    const currentZoom = map.getZoom();
    if (currentZoom && currentZoom < 14) {
      map.setZoom(14);
    }
  }, [center]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-destructive text-sm">
        {error}
      </div>
    );
  }

  const style = typeof height === 'number' ? { height: `${height}px` } : { height };

  return <div ref={containerRef} className={className} style={{ width: '100%', ...style }} />;
}

export default BasicGoogleMap;
