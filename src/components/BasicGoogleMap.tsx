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
  isCluster?: boolean;
  propertyCount?: number;
}

interface BasicGoogleMapProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  height?: string;
  className?: string;
  onReady?: (map: google.maps.Map) => void;
  enableClustering?: boolean;
  isServerClustered?: boolean;
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
  isServerClustered = false,
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

  // ✅ Renderizar marcadores: Server Clusters o Properties
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google) return;

    console.log('🎯 [BasicGoogleMap] Renderizando marcadores:', { 
      count: markers.length,
      isServerClustered,
      enableClustering,
      currentZoom
    });

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

    if (markers.length === 0) return;

    // ✅ MODO 1: Server Clusters - Renderizar círculos grandes con números
    if (isServerClustered) {
      console.log('🔵 [BasicGoogleMap] Modo Server Clusters:', markers.length);
      
      markers.forEach(m => {
        const lat = Number(m.lat);
        const lng = Number(m.lng);
        const position = new google.maps.LatLng(lat, lng);
        const count = m.propertyCount || 0;
        
        // Tamaño dinámico basado en count
        const baseSize = 50;
        const size = Math.min(baseSize + Math.log10(count) * 15, 90);
        
        const svg = `
          <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
            <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" 
              fill="#000000" 
              stroke="white" 
              stroke-width="3" 
              opacity="0.95"/>
            <text x="${size/2}" y="${size/2 + 6}" 
              text-anchor="middle" 
              font-family="system-ui, -apple-system, sans-serif" 
              font-size="18" 
              font-weight="700" 
              fill="white">
              ${count.toLocaleString()}
            </text>
          </svg>
        `;
        
        const marker = new google.maps.Marker({
          position,
          map,
          icon: {
            url: `data:image/svg+xml;base64,${btoa(svg)}`,
            scaledSize: new google.maps.Size(size, size),
            anchor: new google.maps.Point(size/2, size/2),
          },
          title: `${count} propiedades`,
          optimized: false,
        });

        // Hacer zoom in cuando se hace clic en un cluster del servidor
        marker.addListener('click', () => {
          if (map) {
            map.setCenter(position);
            const currentZoom = map.getZoom() || 7;
            map.setZoom(currentZoom + 2);
          }
        });

        markerRefs.current.set(m.id, marker);
      });

      return; // No usar clustering del cliente
    }

    // ✅ MODO 2: Properties - Crear marcadores con pastillas de precios
    console.log('🏠 [BasicGoogleMap] Modo Properties:', markers.length);
    
    const bounds = new google.maps.LatLngBounds();
    let validMarkersCount = 0;
    const newMarkers: google.maps.Marker[] = [];
    
    for (const m of markers) {
      const lat = Number(m.lat);
      const lng = Number(m.lng);
      const position = new google.maps.LatLng(lat, lng);
      
      // ✅ Solo renderizar si tiene precio válido
      if (!m.price || m.price <= 0) continue;
      
      // Formatear precio
      const priceFormatted = new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: m.currency || 'MXN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(m.price);
      
      // Crear pastilla de precio estilo Zillow
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
      
      const marker = new google.maps.Marker({
        position,
        map,
        icon: {
          url: `data:image/svg+xml;base64,${btoa(svg)}`,
          scaledSize: new google.maps.Size(120, 32),
          anchor: new google.maps.Point(60, 16),
        },
        title: m.title || `Propiedad ${m.id}`,
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

    console.log('✅ [BasicGoogleMap] Pastillas de precios creadas:', { 
      total: markers.length,
      valid: validMarkersCount 
    });

    // Aplicar clustering del cliente solo si está habilitado (propiedades individuales)
    if (enableClustering && !isServerClustered && newMarkers.length > 0) {
      try {
        // Renderer personalizado para clusters con color negro (marca Kentra)
        const customRenderer = {
          render: ({ count, position }: { count: number; position: google.maps.LatLng }) => {
            // Tamaño dinámico basado en count del backend
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
            maxZoom: 11,
            gridSize: 40,
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

    // Auto-fit bounds si es necesario
    if (!disableAutoFit && validMarkersCount > 0 && !bounds.isEmpty()) {
      map.fitBounds(bounds);
    }

  }, [markers, currentZoom, enableClustering, isServerClustered, disableAutoFit]);

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
