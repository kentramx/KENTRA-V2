/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";

export type LatLng = { lat: number; lng: number };
export type SimpleMarker = LatLng & {
  id?: string;
  title?: string;
};

interface BareGoogleMapProps {
  center?: LatLng;
  zoom?: number;
  markers?: SimpleMarker[];
  height?: number | string;
  className?: string;
  // Mantener firma de props para compatibilidad con /buscar (se ignoran aquí)
  enableClustering?: boolean;
  disableAutoFit?: boolean;
  hoveredMarkerId?: string | null;
  onBoundsChanged?: (bounds: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
    zoom: number;
  }) => void;
  onMarkerClick?: (markerId: string) => void;
  onMarkerHover?: (markerId: string | null) => void;
  onFavoriteClick?: (markerId: string) => void; // ignorado
}

// Mapa súper simple: sin clusterer, icono por defecto, sólo click/hover
export default function BareGoogleMap({
  center = { lat: 19.4326, lng: -99.1332 },
  zoom = 5,
  markers = [],
  height = "calc(100vh - 8rem)",
  className,
  disableAutoFit = false,
  hoveredMarkerId = null,
  onBoundsChanged,
  onMarkerClick,
  onMarkerHover,
}: BareGoogleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRefs = useRef<Map<string, google.maps.Marker>>(new Map());
  const prevCountRef = useRef<number>(0);
  const prevBoundsRef = useRef<{minLng:number;minLat:number;maxLng:number;maxLat:number;zoom:number} | null>(null);
  const [error, setError] = useState<string | null>(null);

  const EPS = 0.0005;
  const nearlyEqual = (a: number, b: number, eps = EPS) => Math.abs(a - b) <= eps;

  // Mantener callbacks estables
  const onMarkerClickRef = useRef<typeof onMarkerClick>(onMarkerClick);
  const onMarkerHoverRef = useRef<typeof onMarkerHover>(onMarkerHover);
  useEffect(() => { onMarkerClickRef.current = onMarkerClick; }, [onMarkerClick]);
  useEffect(() => { onMarkerHoverRef.current = onMarkerHover; }, [onMarkerHover]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        await loadGoogleMaps();
        if (!mounted || !containerRef.current) return;
        mapRef.current = new google.maps.Map(containerRef.current, {
          center,
          zoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        if (onBoundsChanged && mapRef.current) {
          let t: any;
          mapRef.current.addListener("idle", () => {
            clearTimeout(t);
            t = setTimeout(() => {
              if (!mapRef.current) return;
              const b = mapRef.current.getBounds();
              const z = mapRef.current.getZoom();
              if (b && z != null) {
                const ne = b.getNorthEast();
                const sw = b.getSouthWest();
                const snapshot = {
                  minLng: sw.lng(),
                  minLat: sw.lat(),
                  maxLng: ne.lng(),
                  maxLat: ne.lat(),
                  zoom: z,
                };
                const prev = prevBoundsRef.current;
                const changed = !prev ||
                  prev.zoom !== snapshot.zoom ||
                  !nearlyEqual(prev.minLng, snapshot.minLng) ||
                  !nearlyEqual(prev.minLat, snapshot.minLat) ||
                  !nearlyEqual(prev.maxLng, snapshot.maxLng) ||
                  !nearlyEqual(prev.maxLat, snapshot.maxLat);

                if (changed) {
                  prevBoundsRef.current = snapshot;
                  onBoundsChanged(snapshot);
                }
              }
            }, 250);
          });
        }
      } catch (e: any) {
        setError(e?.message || "No se pudo cargar el mapa");
      }
    };
    init();
    return () => {
      mounted = false;
      markerRefs.current.forEach((m) => m.setMap(null));
      markerRefs.current.clear();
      mapRef.current = null;
    };
  }, []);

  // Renderizar marcadores con diff eficiente
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const incoming = (markers || []).filter(
      (m) => m && m.lat != null && m.lng != null && !isNaN(Number(m.lat)) && !isNaN(Number(m.lng))
    );

    const nextIds = new Set<string>(incoming.map((m) => m.id ?? `${m.lat}:${m.lng}`));

    // Remover marcadores que ya no existen
    markerRefs.current.forEach((marker, id) => {
      if (!nextIds.has(id)) {
        marker.setMap(null);
        markerRefs.current.delete(id);
      }
    });

    // Agregar o actualizar marcadores
    for (const m of incoming) {
      const id = m.id ?? `${m.lat}:${m.lng}`;
      const pos = new google.maps.LatLng(Number(m.lat), Number(m.lng));
      let marker = markerRefs.current.get(id);
      
      if (!marker) {
        // Crear nuevo marcador
        marker = new google.maps.Marker({ 
          position: pos, 
          map, 
          title: m.title 
        });
        markerRefs.current.set(id, marker);

        marker.addListener("click", () => {
          if (m.id) onMarkerClickRef.current?.(m.id);
        });
        marker.addListener("mouseover", () => onMarkerHoverRef.current?.(m.id || null));
        marker.addListener("mouseout", () => onMarkerHoverRef.current?.(null));
      } else {
        // Actualizar posición y título si cambiaron
        const cur = marker.getPosition();
        if (!cur || cur.lat() !== pos.lat() || cur.lng() !== pos.lng()) {
          marker.setPosition(pos);
        }
        if (marker.getTitle() !== (m.title || "")) {
          marker.setTitle(m.title || "");
        }
      }
    }

    // fitBounds solo al pasar de 0->N marcadores y cuando disableAutoFit === false
    if (!disableAutoFit) {
      const hadNone = !prevCountRef.current || prevCountRef.current === 0;
      const nowCount = markerRefs.current.size;
      
      if (hadNone && nowCount > 0) {
        const bounds = new google.maps.LatLngBounds();
        markerRefs.current.forEach((mk) => {
          const p = mk.getPosition();
          if (p) bounds.extend(p);
        });
        
        if (!bounds.isEmpty()) {
          if (nowCount > 1) {
            map.fitBounds(bounds);
          } else if (nowCount === 1) {
            const firstMarker = Array.from(markerRefs.current.values())[0];
            const firstPos = firstMarker.getPosition();
            if (firstPos) map.setCenter(firstPos);
          }
        }
      }
      prevCountRef.current = markerRefs.current.size;
    }
  }, [markers, disableAutoFit]);

  // Resaltar marcador por hover externo
  useEffect(() => {
    markerRefs.current.forEach((marker, id) => {
      if (id === hoveredMarkerId) {
        marker.setAnimation(google.maps.Animation.BOUNCE);
        marker.setZIndex(google.maps.Marker.MAX_ZINDEX + 1);
      } else {
        marker.setAnimation(null);
        marker.setZIndex(undefined);
      }
    });
  }, [hoveredMarkerId]);

  // Reaccionar a cambios de center/zoom
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (center) map.panTo(center);
    if (zoom != null) map.setZoom(zoom);
  }, [center, zoom]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-destructive text-sm">{error}</div>
    );
  }

  const style = typeof height === "number" ? { height: `${height}px` } : { height };
  return <div ref={containerRef} className={className} style={{ width: "100%", ...style }} />;
}
