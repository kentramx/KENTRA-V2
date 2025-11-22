/// <reference types="google.maps" />
import { useEffect, useRef, useState, useMemo } from "react";
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";
import { MarkerClusterer, GridAlgorithm } from "@googlemaps/markerclusterer";
import { monitoring } from "@/lib/monitoring";

// --- (Mantén tus funciones de SVG helpers: getClusterSVG, formatPriceCompact, getPricePillSVG, getPointSVG tal cual las tienes) ---
// ... [Pega aquí tus helpers SVG del archivo anterior para ahorrar espacio en este mensaje] ...

// 🚀 Caché global de SVGs (MANTENER)
const svgCache = new Map<string, string>();

// (Asegúrate de incluir las funciones getClusterSVG, formatPriceCompact, getPricePillSVG, getPointSVG aquí mismo)
const getClusterSVG = (count: number): string => {
  // ... (tu lógica existente)
  const baseSize = 50;
  const size = Math.min(baseSize + Math.log10(count) * 15, 90);
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="#000000" stroke="white" stroke-width="3" opacity="0.95"/>
      <text x="${size / 2}" y="${size / 2}" text-anchor="middle" dominant-baseline="central" fill="white" font-size="${size / 3}" font-weight="700" font-family="system-ui">${count}</text>
    </svg>`;
};

const getPointSVG = (): { svg: string; size: number } => {
  const size = 10;
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="#000000" stroke="white" stroke-width="2"/></svg>`;
  return { svg, size };
};

const getPricePillSVG = (price: number, currency: string): { svg: string; width: number; height: number } => {
  // Simulación simple para el ejemplo, usa tu lógica completa
  const width = 60;
  const height = 28;
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" fill="black" rx="14"/><text x="50%" y="50%" fill="white" dominant-baseline="central" text-anchor="middle">$${price}</text></svg>`;
  return { svg, width, height };
};

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title?: string;
  price?: number;
  currency?: "MXN" | "USD";
  type?: "property" | "cluster";
  count?: number;
}

interface BasicGoogleMapProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  height?: string;
  className?: string;
  onReady?: (map: google.maps.Map) => void;
  enableClustering?: boolean;
  onMarkerClick?: (id: string) => void;
  onFavoriteClick?: (id: string) => void;
  disableAutoFit?: boolean;
  hoveredMarkerId?: string | null;
  hoveredPropertyCoords?: { lat: number; lng: number } | null;
  onMarkerHover?: (id: string | null) => void;
  onBoundsChanged?: (bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
    zoom: number;
    center: { lat: number; lng: number };
  }) => void;
  onMapError?: (error: Error) => void;
}

export function BasicGoogleMap({
  center = { lat: 23.6345, lng: -102.5528 },
  zoom = 5,
  markers = [],
  height = "calc(100vh - 8rem)",
  className,
  onReady,
  enableClustering = true,
  onMarkerClick,
  disableAutoFit = false,
  onBoundsChanged,
  onMapError,
}: BasicGoogleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRefs = useRef<Map<string, google.maps.Marker>>(new Map());
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Estado anterior de markers para diffing
  const previousMarkersRef = useRef<Map<string, MapMarker>>(new Map());

  // Referencias para evitar closures obsoletos
  const onMarkerClickRef = useRef(onMarkerClick);
  const onBoundsChangedRef = useRef(onBoundsChanged);

  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
  }, [onMarkerClick]);
  useEffect(() => {
    onBoundsChangedRef.current = onBoundsChanged;
  }, [onBoundsChanged]);

  // ✅ 1. INICIALIZACIÓN ÚNICA (Sin dependencias de center/zoom)
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (!containerRef.current || mapRef.current) return; // Si ya existe, no hacer nada

      try {
        await loadGoogleMaps();
        if (!mounted || !containerRef.current) return;

        console.log("🗺️ [BasicGoogleMap] Creando instancia del mapa...");

        mapRef.current = new google.maps.Map(containerRef.current, {
          center, // Valor inicial
          zoom, // Valor inicial
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy", // Mejora la experiencia en móvil
          restriction: {
            latLngBounds: {
              north: 32.72,
              south: 14.53,
              west: -118.4,
              east: -86.7,
            },
            strictBounds: false,
          },
        });

        // Listener de Idle (Movimiento terminado)
        mapRef.current.addListener("idle", () => {
          if (!mapRef.current || !onBoundsChangedRef.current) return;

          const bounds = mapRef.current.getBounds();
          const currentZoom = mapRef.current.getZoom();
          const mapCenter = mapRef.current.getCenter();

          if (bounds && currentZoom && mapCenter) {
            const ne = bounds.getNorthEast();
            const sw = bounds.getSouthWest();

            onBoundsChangedRef.current({
              minLat: sw.lat(),
              maxLat: ne.lat(),
              minLng: sw.lng(),
              maxLng: ne.lng(),
              zoom: currentZoom,
              center: { lat: mapCenter.lat(), lng: mapCenter.lng() },
            });
          }
        });

        setError(null);
        onReady?.(mapRef.current);
        setMapReady(true);
      } catch (err) {
        console.error("❌ [BasicGoogleMap] Error:", err);
        const msg = err instanceof Error ? err.message : "Error desconocido";
        setError(msg);
        onMapError?.(err instanceof Error ? err : new Error(msg));
      }
    };

    init();
    return () => {
      mounted = false;
    };
    // ❌ NOTA: NO incluir center ni zoom aquí. Solo []
  }, []);

  // ✅ 2. EFECTO PARA ACTUALIZAR CENTRO (Sin reiniciar)
  useEffect(() => {
    if (mapRef.current && center) {
      const currentCenter = mapRef.current.getCenter();
      // Solo mover si la diferencia es significativa para evitar loops
      if (
        !currentCenter ||
        Math.abs(currentCenter.lat() - center.lat) > 0.0001 ||
        Math.abs(currentCenter.lng() - center.lng) > 0.0001
      ) {
        mapRef.current.panTo(center);
      }
    }
  }, [center.lat, center.lng]);

  // ✅ 3. EFECTO PARA ACTUALIZAR ZOOM (Sin reiniciar)
  useEffect(() => {
    if (mapRef.current && zoom !== undefined) {
      if (mapRef.current.getZoom() !== zoom) {
        mapRef.current.setZoom(zoom);
      }
    }
  }, [zoom]);

  // ✅ 4. RENDERIZADO DE MARCADORES (Tu lógica existente de diffing es buena, la mantenemos)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google || !mapReady) return;

    // ... (Aquí va tu lógica de diffing y creación de marcadores que ya tenías) ...
    // Pega aquí el bloque "const currentMarkersMap = ..." hasta el final del useEffect de marcadores
    // del archivo que subiste. Esa parte estaba bien.
    // Lo importante es que al ejecutarse, usa `mapRef.current` que YA EXISTE y no se ha reiniciado.

    const currentMarkersMap = new Map<string, MapMarker>();
    markers.forEach((m) => currentMarkersMap.set(m.id, m));

    const toAdd = new Set<string>();
    const toRemove = new Set<string>();

    // Simple diffing para el ejemplo (puedes usar tu lógica más compleja si prefieres)
    currentMarkersMap.forEach((_, id) => {
      if (!markerRefs.current.has(id)) toAdd.add(id);
    });
    markerRefs.current.forEach((_, id) => {
      if (!currentMarkersMap.has(id)) toRemove.add(id);
    });

    // Remover
    toRemove.forEach((id) => {
      markerRefs.current.get(id)?.setMap(null);
      markerRefs.current.delete(id);
    });

    // Agregar
    toAdd.forEach((id) => {
      const m = currentMarkersMap.get(id)!;
      // ... Lógica de creación de marcador ...
      // Para este ejemplo rápido, una creación simple,
      // pero TÚ DEBES USAR TU LÓGICA DE SVG E ICONOS AQUÍ
      const position = new google.maps.LatLng(Number(m.lat), Number(m.lng));

      // Lógica de Zoom para iconos
      const currentMapZoom = map.getZoom() || zoom;
      const showPrice = currentMapZoom >= 12;
      let svg = getPointSVG().svg; // Default

      if (m.type === "cluster") svg = getClusterSVG(m.count || 0);
      else if (showPrice) svg = getPricePillSVG(m.price || 0, m.currency || "MXN").svg;

      const marker = new google.maps.Marker({
        position,
        map,
        icon: {
          url: `data:image/svg+xml;base64,${btoa(svg)}`,
          // ... sizes ...
        },
        zIndex: m.type === "cluster" ? 100 : 50,
      });

      marker.addListener("click", () => onMarkerClickRef.current?.(m.id));
      markerRefs.current.set(m.id, marker);
    });

    // Clustering (simplificado para el ejemplo)
    if (enableClustering && clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current.addMarkers([...markerRefs.current.values()]);
    } else if (enableClustering && !clustererRef.current) {
      // Inicializar clusterer si no existe
      clustererRef.current = new MarkerClusterer({ map, markers: [...markerRefs.current.values()] });
    }
  }, [markers, enableClustering, mapReady]); // Dependencias

  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return <div ref={containerRef} className={className} style={{ height, width: "100%" }} />;
}
