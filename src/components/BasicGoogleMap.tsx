/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                   KENTRA MAP STACK - COMPONENTE OFICIAL                      ║
 * ║                       Componente Base de Google Maps                         ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 * 
 * 📍 PROPÓSITO:
 * Este es el componente BASE OFICIAL para todos los mapas de Kentra.
 * Proporciona la funcionalidad fundamental de Google Maps con marcadores
 * personalizados, clustering, y manejo de eventos.
 * 
 * 🛠️ TECNOLOGÍA:
 * - Google Maps JavaScript API
 * - @googlemaps/markerclusterer para clustering automático
 * - SVG markers personalizados (píldoras de precio, clusters, puntos)
 * 
 * 🎯 CARACTERÍSTICAS:
 * - Renderizado eficiente con diffing de marcadores (evita recreaciones innecesarias)
 * - Clustering adaptativo con algoritmo Grid
 * - Marcadores dinámicos según zoom (píldoras de precio en zoom cercano, puntos en lejano)
 * - Caché global de SVGs para rendimiento
 * - Restricción geográfica a México
 * - Debounce de eventos de bounds change
 * 
 * 🔧 USADO POR:
 * - SearchMap (mapa de búsqueda)
 * - Otros componentes que requieran un mapa base
 * 
 * 📦 DEPENDENCIAS OFICIALES:
 * - loadGoogleMaps (loader de API)
 * 
 * ⚠️ IMPORTANTE:
 * Este es el único componente base de mapas en el proyecto.
 * Cualquier mejora al sistema de marcadores o rendering debe hacerse aquí.
 */
/// <reference types="google.maps" />
import { useEffect, useRef, useState, useMemo } from 'react';
import { loadGoogleMaps } from '@/lib/loadGoogleMaps';
import { MarkerClusterer, GridAlgorithm } from '@googlemaps/markerclusterer';
import { monitoring } from '@/lib/monitoring';

// 🔧 Debug flag controlado para logs de diagnóstico
const MAP_DEBUG = typeof window !== 'undefined' && (window as any).__KENTRA_MAP_DEBUG__ === true;

// 🚀 Caché global de SVGs para evitar regenerar el mismo ícono muchas veces
const svgCache = new Map<string, string>();

// Generar SVG de cluster memoizado
const getClusterSVG = (count: number): string => {
  const cacheKey = `cluster-${count}`;
  if (svgCache.has(cacheKey)) {
    return svgCache.get(cacheKey)!;
  }
  
  // ✅ Limpieza automática de caché si supera 500 entradas
  if (svgCache.size > 500) {
    svgCache.clear();
  }
  
  const baseSize = 50;
  const size = Math.min(baseSize + Math.log10(count) * 15, 90);
  
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" 
        fill="#000000" 
        stroke="white" 
        stroke-width="3" 
        opacity="0.95"/>
      <text x="${size/2}" y="${size/2}" 
        text-anchor="middle" 
        dominant-baseline="central"
        fill="white" 
        font-size="${size/3}"
        font-weight="700"
        font-family="system-ui, -apple-system, sans-serif">
        ${count}
      </text>
    </svg>
  `;
  
  svgCache.set(cacheKey, svg);
  return svg;
};

// Formatear precio de forma compacta (1.5M, 850K, etc.)
const formatPriceCompact = (price: number, currency: string): string => {
  const symbol = currency === 'USD' ? '$' : '$';
  
  if (price >= 1_000_000) {
    const millions = price / 1_000_000;
    return `${symbol}${millions.toFixed(millions >= 10 ? 0 : 1)}M`;
  } else if (price >= 1_000) {
    const thousands = price / 1_000;
    return `${symbol}${thousands.toFixed(0)}K`;
  }
  return `${symbol}${price.toFixed(0)}`;
};

// Generar SVG de píldora de precio memoizado (Zoom cercano)
const getPricePillSVG = (price: number, currency: string): { svg: string; width: number; height: number } => {
  const priceLabel = formatPriceCompact(price, currency);
  const cacheKey = `pill-${priceLabel}`;
  
  if (svgCache.has(cacheKey)) {
    const cached = svgCache.get(cacheKey)!;
    const [svg, w, h] = cached.split('|');
    return { svg, width: parseInt(w), height: parseInt(h) };
  }
  
  // ✅ Limpieza automática de caché si supera 500 entradas
  if (svgCache.size > 500) {
    svgCache.clear();
  }
  
  // Cálculo de ancho dinámico: ~8px por caracter + 24px de padding lateral
  const width = Math.max(40, (priceLabel.length * 8) + 24);
  const height = 28;
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity="0.3"/>
        </filter>
      </defs>
      <g filter="url(#shadow)">
        <rect x="1" y="1" width="${width-2}" height="${height-2}" rx="${(height-2)/2}" fill="#000000" stroke="white" stroke-width="1"/>
        <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" 
          font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" 
          font-weight="bold" font-size="12" fill="#ffffff">
          ${priceLabel}
        </text>
      </g>
    </svg>
  `;
  
  svgCache.set(cacheKey, `${svg}|${width}|${height}`);
  return { svg, width, height };
};

// Generar SVG de punto simple (Zoom lejano)
const getPointSVG = (): { svg: string; size: number } => {
  const cacheKey = 'point-simple';
  
  if (svgCache.has(cacheKey)) {
    const cached = svgCache.get(cacheKey)!;
    const [svg, s] = cached.split('|');
    return { svg, size: parseInt(s) };
  }
  
  const size = 10;
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 1}" fill="#000000" stroke="white" stroke-width="2"/>
    </svg>
  `;
  
  svgCache.set(cacheKey, `${svg}|${size}`);
  return { svg, size };
};

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title?: string;
  price?: number;
  currency?: 'MXN' | 'USD';
  type?: 'property' | 'cluster';
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
  disableAutoFit?: boolean;
  onBoundsChanged?: (bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
    zoom: number;
    center: { lat: number; lng: number };
  }) => void;
  onMapError?: (error: Error) => void;
  // ✅ Hover sync: ID del marker a resaltar
  hoveredMarkerId?: string | null;
  // ✅ Click sync: centrar mapa en estas coordenadas
  centerOnCoordinates?: { lat: number; lng: number } | null;
}

export function BasicGoogleMap({
  center = { lat: 23.6345, lng: -102.5528 },
  zoom = 5,
  markers = [],
  height = 'calc(100vh - 8rem)',
  className,
  onReady,
  enableClustering = true,
  onMarkerClick,
  disableAutoFit = false,
  onBoundsChanged,
  onMapError,
  hoveredMarkerId,
  centerOnCoordinates,
}: BasicGoogleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRefs = useRef<Map<string, google.maps.Marker>>(new Map());
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  
  // 🎯 Estado anterior de markers para diffing
  const previousMarkersRef = useRef<Map<string, MapMarker>>(new Map());

  // 🔒 Refs para evitar re-inicialización del mapa al cambiar props
  const initialZoomRef = useRef(zoom);
  const initialCenterRef = useRef(center);
  const mapInitializedRef = useRef(false);

  // 🎯 Firma estable del set de IDs clusterizables (solo properties)
  const clusterSignature = useMemo(() => {
    const ids: string[] = [];
    for (const m of markers) {
      if (m.type === 'property') {
        ids.push(m.id);
      }
    }
    ids.sort();
    return ids.join('|');
  }, [markers]);

  const lastClusterSignatureRef = useRef<string>('');

  // Mantener callbacks estables sin re-crear marcadores
  const onMarkerClickRef = useRef<((id: string) => void) | undefined>(onMarkerClick);
  useEffect(() => { onMarkerClickRef.current = onMarkerClick; }, [onMarkerClick]);

  // ✅ Inicializar mapa con Google Maps API
  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      // 🔒 Si el mapa ya fue inicializado, NO re-inicializar
      if (mapInitializedRef.current && mapRef.current) {
        return;
      }
      
      if (!containerRef.current) return;
      
      try {
        await loadGoogleMaps();
        if (!mounted || !containerRef.current) return;
        
        if (MAP_DEBUG) {
          console.log('[KENTRA MAP] Inicializando mapa', {
            center,
            zoom,
            totalMarkers: markers.length
          });
        }

        mapRef.current = new google.maps.Map(containerRef.current, {
          center: initialCenterRef.current,  // usar ref en lugar de prop
          zoom: initialZoomRef.current,      // usar ref en lugar de prop
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          restriction: {
            latLngBounds: {
              north: 32.72,
              south: 14.53,
              west: -118.40,
              east: -86.70,
            },
            strictBounds: false,
          },
        });
        
        mapInitializedRef.current = true;

        // Setup bounds changed listener with debounce
        if (onBoundsChanged && mapRef.current) {
          let boundsChangeTimeout: NodeJS.Timeout;
          mapRef.current.addListener('idle', () => {
            clearTimeout(boundsChangeTimeout);
            boundsChangeTimeout = setTimeout(() => {
              if (!mapRef.current) return;
              const bounds = mapRef.current.getBounds();
              const zoom = mapRef.current.getZoom();
              
              if (zoom !== undefined) {
                setCurrentZoom(zoom);
              }
              
              if (bounds && zoom) {
                const ne = bounds.getNorthEast();
                const sw = bounds.getSouthWest();
                const mapCenter = mapRef.current.getCenter();
                
                if (MAP_DEBUG) {
                  console.log('[KENTRA MAP] Bounds actualizados', {
                    minLng: sw.lng().toFixed(4),
                    minLat: sw.lat().toFixed(4),
                    maxLng: ne.lng().toFixed(4),
                    maxLat: ne.lat().toFixed(4),
                    zoom
                  });
                }
                
                onBoundsChanged({
                  minLat: sw.lat(),
                  maxLat: ne.lat(),
                  minLng: sw.lng(),
                  maxLng: ne.lng(),
                  zoom,
                  center: { 
                    lat: mapCenter?.lat() || center.lat, 
                    lng: mapCenter?.lng() || center.lng 
                  },
                });
              }
            }, 300);
          });
        }

        setError(null);
        onReady?.(mapRef.current);
        setMapReady(true);
        
        monitoring.debug('[BasicGoogleMap] Mapa inicializado correctamente');
      } catch (err) {
        if (MAP_DEBUG) {
          console.error('[KENTRA MAP] Error al inicializar mapa', err);
        }
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
        setError(errorMessage);
        onMapError?.(err instanceof Error ? err : new Error(errorMessage));
        monitoring.error('[BasicGoogleMap] Error al inicializar mapa', { error: err });
      }
    };
    
    init();
    return () => { mounted = false; };
  }, [onReady, onBoundsChanged, onMapError]);

  // ✅ Renderizar pastillas de precios estilo Zillow (OPTIMIZADO con diffing)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google || !mapReady) return;

    const renderStartTime = performance.now();
    
    // 🔍 Construir mapa de marcadores actuales para diffing
    const currentMarkersMap = new Map<string, MapMarker>();
    markers.forEach(m => currentMarkersMap.set(m.id, m));
    
    // 🎯 Detectar cambios: qué marcadores añadir, actualizar o eliminar
    const toAdd = new Set<string>();
    const toUpdate = new Set<string>();
    const toRemove = new Set<string>();
    
    // Detectar nuevos marcadores o actualizados
    currentMarkersMap.forEach((marker, id) => {
      const previous = previousMarkersRef.current.get(id);
      if (!previous) {
        toAdd.add(id);
      } else {
        // Comparar si cambió algo relevante
        const changed = 
          previous.lat !== marker.lat ||
          previous.lng !== marker.lng ||
          previous.price !== marker.price ||
          previous.count !== marker.count ||
          previous.type !== marker.type;
        
        if (changed) {
          toUpdate.add(id);
        }
      }
    });
    
    // Detectar marcadores eliminados
    previousMarkersRef.current.forEach((_, id) => {
      if (!currentMarkersMap.has(id)) {
        toRemove.add(id);
      }
    });
    
    const changesDetected = toAdd.size + toUpdate.size + toRemove.size;
    
    // ✅ Si no hay cambios, skip completo
    if (changesDetected === 0) {
      if (MAP_DEBUG) {
        console.log('[KENTRA MAP] Sin cambios, skip renderizado');
      }
      return;
    }
    
    if (MAP_DEBUG) {
      console.log('[KENTRA MAP] Actualizando marcadores', { 
        total: markers.length,
        toAdd: toAdd.size,
        toUpdate: toUpdate.size, 
        toRemove: toRemove.size 
      });
    }

    // 🗑️ Eliminar marcadores obsoletos
    toRemove.forEach(id => {
      const marker = markerRefs.current.get(id);
      if (marker) {
        marker.setMap(null);
        markerRefs.current.delete(id);
      }
    });
    
    // 🔄 Actualizar marcadores cambiados (eliminar y recrear)
    toUpdate.forEach(id => {
      const marker = markerRefs.current.get(id);
      if (marker) {
        marker.setMap(null);
        markerRefs.current.delete(id);
      }
      toAdd.add(id); // Recrear como nuevo
    });


    // Crear bounds para auto-fit
    const bounds = new google.maps.LatLngBounds();
    let validMarkersCount = 0;
    const newMarkers: google.maps.Marker[] = [];
    const hasBackendClusters = markers.some(m => m.type === 'cluster');
    
    // ➕ Crear solo marcadores nuevos o actualizados
    for (const m of markers) {
      // Si ya existe y no necesita actualización, skip
      if (markerRefs.current.has(m.id) && !toAdd.has(m.id)) {
        const existingMarker = markerRefs.current.get(m.id)!;
        newMarkers.push(existingMarker);
        bounds.extend(existingMarker.getPosition()!);
        validMarkersCount++;
        continue;
      }
      
      // Solo crear si está en la lista de añadir
      if (!toAdd.has(m.id)) continue;
      
      const lat = Number(m.lat);
      const lng = Number(m.lng);
      const position = new google.maps.LatLng(lat, lng);
      
      // ✅ Solo filtrar por precio si es property
      if (m.type === 'property' && (!m.price || m.price <= 0)) continue;
      
      // 🎯 Lógica de Zoom: obtener zoom actual del mapa
      const currentMapZoom = map.getZoom() || zoom;
      const showPrice = currentMapZoom >= 12;
      
      let svg: string;
      let iconSize: google.maps.Size;
      let iconAnchor: google.maps.Point;
      let zIndex = 1;
      
      if (m.type === 'cluster') {
        // 🚀 Cluster: Círculo negro con número
        const count = m.count || 0;
        const baseSize = 50;
        const size = Math.min(baseSize + Math.log10(count) * 15, 90);
        svg = getClusterSVG(count);
        iconSize = new google.maps.Size(size, size);
        iconAnchor = new google.maps.Point(size / 2, size / 2);
        zIndex = 100;
      } else if (!showPrice) {
        // 🚀 Punto simple (Zoom lejano < 12)
        const { svg: pointSvg, size: pointSize } = getPointSVG();
        svg = pointSvg;
        iconSize = new google.maps.Size(pointSize, pointSize);
        iconAnchor = new google.maps.Point(pointSize / 2, pointSize / 2);
        zIndex = 10;
      } else {
        // 🚀 Píldora de precio (Zoom cercano >= 12)
        const { svg: pillSvg, width, height } = getPricePillSVG(m.price || 0, m.currency || 'MXN');
        svg = pillSvg;
        iconSize = new google.maps.Size(width, height);
        iconAnchor = new google.maps.Point(width / 2, height / 2);
        zIndex = 50;
      }
      
      const marker = new google.maps.Marker({
        position,
        map,
        icon: {
          url: `data:image/svg+xml;base64,${btoa(svg)}`,
          scaledSize: iconSize,
          anchor: iconAnchor,
        },
        title: m.type === 'cluster'
          ? `${m.count} propiedades - Clic para acercar`
          : (m.title || `Propiedad ${m.id}`),
        cursor: 'pointer',
        optimized: false,
        zIndex,
      });

      // Event listener para clic
      marker.addListener('click', () => {
        // ✅ Si es un cluster del backend, hacer zoom al área
        if (m.type === 'cluster') {
          const currentZoom = map.getZoom() || 5;
          map.setCenter(position);
          map.setZoom(Math.min(currentZoom + 3, 15));
          return;
        }
        // Para propiedades individuales, llamar al callback
        onMarkerClickRef.current?.(m.id);
      });

      markerRefs.current.set(m.id, marker);
      newMarkers.push(marker);
      bounds.extend(position);
      validMarkersCount++;
    }
    
    // 💾 Actualizar estado anterior para próximo diffing
    previousMarkersRef.current = currentMarkersMap;

    // Auto-fit al bounds si está habilitado
    if (!disableAutoFit && validMarkersCount > 0 && !bounds.isEmpty()) {
      map.fitBounds(bounds);
      
      const listener = google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
        const currentZoom = map.getZoom();
        if (currentZoom && currentZoom > 15) {
          map.setZoom(15);
        }
      });

      setTimeout(() => {
        google.maps.event.removeListener(listener);
      }, 100);
    }

    const renderTime = performance.now() - renderStartTime;
    
    if (MAP_DEBUG) {
      console.log('[KENTRA MAP] Renderizado completo', { 
        markersCount: validMarkersCount,
        renderTimeMs: renderTime.toFixed(2),
        clustering: enableClustering 
      });
    }

  }, [markers, enableClustering, disableAutoFit, mapReady, currentZoom]);

  // ✅ Ciclo de vida INDEPENDIENTE del MarkerClusterer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const hasBackendClusters = markers.some(m => m.type === 'cluster');

    // 🧹 Cleanup total: si clustering local está OFF o hay backend clusters
    if (!enableClustering || hasBackendClusters) {
      if (clustererRef.current) {
        if (MAP_DEBUG) {
          console.log('[KENTRA MAP] Deshabilitando clusterer local');
        }
        clustererRef.current.clearMarkers();
        clustererRef.current.setMap(null);
        clustererRef.current = null;
      }
      lastClusterSignatureRef.current = '';
      return;
    }

    // ✅ Si el set real de IDs NO cambió, NO tocar el clusterer
    if (lastClusterSignatureRef.current === clusterSignature) {
      if (MAP_DEBUG) {
        console.log('[KENTRA MAP] Clusterer: firma estable, skip reconstrucción');
      }
      return;
    }

    if (MAP_DEBUG) {
      console.log('[KENTRA MAP] Clusterer: firma cambió, reconstruyendo', {
        prev: lastClusterSignatureRef.current.substring(0, 50) + '...',
        next: clusterSignature.substring(0, 50) + '...',
      });
    }

    lastClusterSignatureRef.current = clusterSignature;

    // 📋 Lista completa de markers vivas para clustering (O(n))
    const markersToCluster: google.maps.Marker[] = [];
    
    for (const [id, gMarker] of markerRefs.current.entries()) {
      // previousMarkersRef.current ya fue actualizado al final del diffing
      const meta = previousMarkersRef.current.get(id);
      if (meta?.type === 'property') {
        markersToCluster.push(gMarker);
      }
    }

    if (markersToCluster.length === 0) {
      if (MAP_DEBUG) {
        console.log('[KENTRA MAP] No hay markers clusterizables, skip');
      }
      return;
    }

    // 🗑️ Limpiar clusterer anterior si existe
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current.setMap(null);
    }

    // 🚀 Crear nuevo clusterer con lista completa
    try {
      const customRenderer = {
        render: ({ count, position }: { count: number; position: google.maps.LatLng }) => {
          const svg = getClusterSVG(count);
          const baseSize = 50;
          const size = Math.min(baseSize + Math.log10(count) * 15, 90);

          return new google.maps.Marker({
            position,
            icon: {
              url: `data:image/svg+xml;base64,${btoa(svg)}`,
              scaledSize: new google.maps.Size(size, size),
              anchor: new google.maps.Point(size / 2, size / 2),
            },
            zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count,
          });
        },
      };

      clustererRef.current = new MarkerClusterer({
        map,
        markers: markersToCluster,
        algorithm: new GridAlgorithm({ 
          maxZoom: 15,
          gridSize: 60,
          maxDistance: 30000,
        }),
        onClusterClick: (_, cluster, map) => {
          map.setCenter(cluster.position);
          map.setZoom(Math.min((map.getZoom() || 5) + 3, 15));
        },
        renderer: customRenderer,
      });

      if (MAP_DEBUG) {
        console.log('[KENTRA MAP] Clusterer reconstruido', {
          markersCount: markersToCluster.length
        });
      }
    } catch (err) {
      monitoring.error('[BasicGoogleMap] Error al crear clusterer', { error: err });
      if (MAP_DEBUG) {
        console.error('[KENTRA MAP] Error al crear clusterer', err);
      }
    }

  }, [mapReady, enableClustering, markers, clusterSignature]);

  // ✅ Hover sync: resaltar marker cuando hoveredMarkerId cambia
  useEffect(() => {
    if (!mapReady || !hoveredMarkerId) return;

    const marker = markerRefs.current.get(hoveredMarkerId);
    if (!marker) return;

    // Guardar zIndex original y aumentarlo
    const originalZIndex = marker.getZIndex() || 1;
    marker.setZIndex(1000);

    // Agregar animación de bounce
    marker.setAnimation(google.maps.Animation.BOUNCE);

    // Detener bounce después de 700ms (1 bounce completo)
    const bounceTimeout = setTimeout(() => {
      marker.setAnimation(null);
    }, 700);

    // Cleanup: restaurar estado original
    return () => {
      clearTimeout(bounceTimeout);
      marker.setAnimation(null);
      marker.setZIndex(originalZIndex);
    };
  }, [hoveredMarkerId, mapReady]);

  // ✅ Click sync: centrar mapa cuando centerOnCoordinates cambia
  useEffect(() => {
    if (!mapReady || !mapRef.current || !centerOnCoordinates) return;

    const { lat, lng } = centerOnCoordinates;

    // Centrar mapa con animación suave
    mapRef.current.panTo({ lat, lng });

    // Hacer zoom si está muy lejos
    const currentZoom = mapRef.current.getZoom() || 5;
    if (currentZoom < 14) {
      mapRef.current.setZoom(14);
    }
  }, [centerOnCoordinates, mapReady]);

  if (error) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-center p-4">
          <p className="text-destructive font-medium mb-2">Error al cargar el mapa</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className={className} 
      style={{ height, width: '100%' }}
    />
  );
}
