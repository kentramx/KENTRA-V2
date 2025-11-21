/// <reference types="google.maps" />
import { useEffect, useRef, useState, useMemo } from 'react';
import { loadGoogleMaps } from '@/lib/loadGoogleMaps';
import { MarkerClusterer, GridAlgorithm } from '@googlemaps/markerclusterer';
import { monitoring } from '@/lib/monitoring';

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

// Generar SVG de precio memoizado
const getPriceSVG = (price: number, currency: string): string => {
  const cacheKey = `price-${price}-${currency}`;
  if (svgCache.has(cacheKey)) {
    return svgCache.get(cacheKey)!;
  }
  
  // ✅ Limpieza automática de caché si supera 500 entradas
  if (svgCache.size > 500) {
    svgCache.clear();
  }
  
  const priceFormatted = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
  
  const priceLabel = priceFormatted.replace('MXN', '$').replace('USD', '$');
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 32">
      <rect x="0" y="0" width="120" height="32" rx="16" 
        fill="white" stroke="#000" stroke-width="2" opacity="0.95"/>
      <text x="60" y="20" text-anchor="middle" 
        font-family="system-ui, -apple-system, sans-serif" 
        font-size="14" font-weight="700" fill="#000">
        ${priceLabel}
      </text>
    </svg>
  `;
  
  svgCache.set(cacheKey, svg);
  return svg;
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
  height = 'calc(100vh - 8rem)',
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
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  
  // 🎯 Estado anterior de markers para diffing
  const previousMarkersRef = useRef<Map<string, MapMarker>>(new Map());

  // Mantener callbacks estables sin re-crear marcadores
  const onMarkerClickRef = useRef<((id: string) => void) | undefined>(onMarkerClick);
  useEffect(() => { onMarkerClickRef.current = onMarkerClick; }, [onMarkerClick]);

  // ✅ Inicializar mapa con Google Maps API
  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      if (!containerRef.current) return;
      
      try {
        await loadGoogleMaps();
        if (!mounted || !containerRef.current) return;
        
        console.log('🗺️ [BasicGoogleMap] Inicializando mapa con marcadores nativos:', {
          center,
          zoom,
          totalMarkers: markers.length
        });

        mapRef.current = new google.maps.Map(containerRef.current, {
          center,
          zoom,
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
                
                console.log('🗺️ [BasicGoogleMap] Bounds cambiados:', {
                  minLng: sw.lng(),
                  minLat: sw.lat(),
                  maxLng: ne.lng(),
                  maxLat: ne.lat(),
                  zoom,
                  center: { lat: mapCenter?.lat(), lng: mapCenter?.lng() }
                });
                
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
        console.error('❌ [BasicGoogleMap] Error al inicializar:', err);
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
        setError(errorMessage);
        onMapError?.(err instanceof Error ? err : new Error(errorMessage));
        monitoring.error('[BasicGoogleMap] Error al inicializar mapa', { error: err });
      }
    };
    
    init();
    return () => { mounted = false; };
  }, [center.lat, center.lng, zoom, onReady, onBoundsChanged, onMapError]);

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
      console.log('⚡ [BasicGoogleMap] Sin cambios detectados, skip renderizado');
      return;
    }
    
    console.log('🎯 [BasicGoogleMap] Diffing:', { 
      total: markers.length,
      toAdd: toAdd.size,
      toUpdate: toUpdate.size, 
      toRemove: toRemove.size 
    });

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

    // Limpiar clusterer solo si hay cambios estructurales
    if (clustererRef.current && (toAdd.size > 0 || toRemove.size > 0 || toUpdate.size > 0)) {
      clustererRef.current.clearMarkers();
      clustererRef.current = null;
    }

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
      
      let svg: string;
      let iconSize: google.maps.Size;
      let iconAnchor: google.maps.Point;
      
      if (m.type === 'cluster') {
        // 🚀 Usar SVG memoizado de cluster
        const count = m.count || 0;
        svg = getClusterSVG(count);
        const baseSize = 50;
        const size = Math.min(baseSize + Math.log10(count) * 15, 90);
        iconSize = new google.maps.Size(size, size);
        iconAnchor = new google.maps.Point(size / 2, size / 2);
      } else {
        // 🚀 Usar SVG memoizado de precio
        svg = getPriceSVG(m.price || 0, m.currency || 'MXN');
        iconSize = new google.maps.Size(120, 32);
        iconAnchor = new google.maps.Point(60, 16);
      }
      
      const marker = new google.maps.Marker({
        position,
        map,
        icon: {
          url: `data:image/svg+xml;base64,${btoa(svg)}`,
          scaledSize: iconSize,
          anchor: iconAnchor,
        },
        title: m.title || (m.type === 'cluster' ? `Cluster ${m.count}` : `Propiedad ${m.id}`),
        optimized: false,
      });

      // Event listener para clic
      if (onMarkerClickRef.current) {
        marker.addListener('click', () => {
          onMarkerClickRef.current?.(m.id);
        });
      }

      markerRefs.current.set(m.id, marker);
      newMarkers.push(marker);
      bounds.extend(position);
      validMarkersCount++;
    }
    
    // 💾 Actualizar estado anterior para próximo diffing
    previousMarkersRef.current = currentMarkersMap;

    console.log('✅ [BasicGoogleMap] Marcadores actualizados:', { 
      total: markers.length,
      valid: validMarkersCount,
      hasBackendClusters,
      added: toAdd.size,
      updated: toUpdate.size,
      removed: toRemove.size
    });

    // Aplicar clustering solo si NO hay clusters del backend
    if (enableClustering && !hasBackendClusters && newMarkers.length > 0) {
      try {
        // Renderer personalizado usando SVGs memoizados
        const customRenderer = {
          render: ({ count, position }: { count: number; position: google.maps.LatLng }) => {
            // 🚀 Usar SVG memoizado
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
          markers: newMarkers,
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
        
        console.log('🎨 [BasicGoogleMap] Clustering aplicado');
      } catch (err) {
        console.error('❌ Error al crear clusterer:', err);
        monitoring.error('[BasicGoogleMap] Error al crear clusterer', { error: err });
      }
    }

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
    monitoring.debug(`[BasicGoogleMap] Renderizado completo`, { 
      markersCount: validMarkersCount,
      renderTime: `${renderTime.toFixed(2)}ms`,
      clustering: enableClustering 
    });

  }, [markers, enableClustering, disableAutoFit, mapReady]);

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
