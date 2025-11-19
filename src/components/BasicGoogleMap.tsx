/// <reference types="google.maps" />
import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/lib/loadGoogleMaps';
import { MarkerClusterer, GridAlgorithm } from '@googlemaps/markerclusterer';
import { monitoring } from '@/lib/monitoring';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title?: string;
  price?: number;
  currency?: 'MXN' | 'USD';
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

  // ✅ Renderizar marcadores nativos de Google Maps (globos rojos estándar)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google) return;

    const renderStartTime = performance.now();
    console.log('🎯 [BasicGoogleMap] Renderizando marcadores nativos:', { count: markers.length });

    // Limpiar marcadores existentes
    markerRefs.current.forEach(marker => marker.setMap(null));
    markerRefs.current.clear();

    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current = null;
    }

    if (infoWindowRef.current) {
      infoWindowRef.current.close();
    }

    // Crear bounds para auto-fit
    const bounds = new google.maps.LatLngBounds();
    let validMarkersCount = 0;

    // Crear marcadores nativos de Google Maps
    const newMarkers: google.maps.Marker[] = [];
    
    for (const m of markers) {
      const lat = Number(m.lat);
      const lng = Number(m.lng);
      const position = new google.maps.LatLng(lat, lng);
      
      // ✅ Crear marcador nativo de Google Maps (globo rojo estándar)
      const marker = new google.maps.Marker({
        position,
        map,
        title: m.title || `Propiedad ${m.id}`,
        // Sin icon personalizado = usa el globo rojo estándar de Google
        optimized: true,
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

    console.log('✅ [BasicGoogleMap] Marcadores nativos creados:', { 
      total: markers.length,
      valid: validMarkersCount 
    });

    // Aplicar clustering si está habilitado
    if (enableClustering && newMarkers.length > 0) {
      try {
        // Renderer personalizado para clusters con color Kentra
        const customRenderer = {
          render: ({ count, position }: { count: number; position: google.maps.LatLng }) => {
            const baseSize = 40;
            const size = Math.min(baseSize + Math.log10(count) * 10, 70);
            
            const svg = `
              <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
                <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" 
                  fill="hsl(var(--primary))" 
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

  }, [markers, enableClustering, disableAutoFit]);

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
