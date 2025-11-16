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
  const [error, setError] = useState<string | null>(null);

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
                onBoundsChanged({
                  minLng: sw.lng(),
                  minLat: sw.lat(),
                  maxLng: ne.lng(),
                  maxLat: ne.lat(),
                  zoom: z,
                });
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

  // Renderizar marcadores básicos
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Limpiar previos
    markerRefs.current.forEach((m) => m.setMap(null));
    markerRefs.current.clear();

    const valid = (markers || []).filter(
      (m) => m && m.lat != null && m.lng != null && !isNaN(Number(m.lat)) && !isNaN(Number(m.lng))
    );

    if (valid.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

    for (const m of valid) {
      const marker = new google.maps.Marker({
        position: { lat: Number(m.lat), lng: Number(m.lng) },
        map,
        title: m.title,
      });

      if (m.id) markerRefs.current.set(m.id, marker);

      marker.addListener("click", () => {
        if (m.id) onMarkerClickRef.current?.(m.id);
      });
      marker.addListener("mouseover", () => onMarkerHoverRef.current?.(m.id || null));
      marker.addListener("mouseout", () => onMarkerHoverRef.current?.(null));

      const pos = marker.getPosition();
      if (pos) bounds.extend(pos);
    }

    if (!disableAutoFit) {
      const arr = Array.from(markerRefs.current.values());
      if (arr.length > 1) map.fitBounds(bounds);
      else if (arr.length === 1) map.setCenter(arr[0].getPosition()!);
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
