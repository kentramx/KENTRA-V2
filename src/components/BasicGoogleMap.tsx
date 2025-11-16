/// <reference types="google.maps" />
import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/lib/loadGoogleMaps';
import { MarkerClusterer, GridAlgorithm } from '@googlemaps/markerclusterer';
import { useCurrencyConversion } from '@/hooks/useCurrencyConversion';

type LatLng = { lat: number; lng: number };
type BasicMarker = LatLng & { 
  id?: string;
  title?: string;
  price?: number;
  currency?: 'MXN' | 'USD';
  bedrooms?: number | null;
  bathrooms?: number | null;
  images?: { url: string; position: number }[];
  listing_type?: 'venta' | 'renta';
  address?: string;
};

interface BasicGoogleMapProps {
  center?: LatLng;
  zoom?: number;
  markers?: BasicMarker[];
  height?: number | string;
  className?: string;
  onReady?: (map: google.maps.Map) => void;
  enableClustering?: boolean;
  onMarkerClick?: (markerId: string) => void;
  onFavoriteClick?: (markerId: string) => void;
  disableAutoFit?: boolean;
  hoveredMarkerId?: string | null;
  onMarkerHover?: (markerId: string | null) => void;
  onBoundsChanged?: (bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number; zoom: number }) => void;
}

export function BasicGoogleMap({
  center = { lat: 19.4326, lng: -99.1332 },
  zoom = 12,
  markers = [],
  height = 'calc(100vh - 8rem)',
  className,
  onReady,
  enableClustering = true,
  onMarkerClick,
  onFavoriteClick,
  disableAutoFit = false,
  hoveredMarkerId = null,
  onMarkerHover,
  onBoundsChanged,
}: BasicGoogleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRefs = useRef<Map<string, google.maps.Marker>>(new Map());
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { formatPrice } = useCurrencyConversion();

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

        // Setup bounds changed listener with debounce
        if (onBoundsChanged && mapRef.current) {
          let boundsChangeTimeout: NodeJS.Timeout;
          mapRef.current.addListener('idle', () => {
            clearTimeout(boundsChangeTimeout);
            boundsChangeTimeout = setTimeout(() => {
              if (!mapRef.current) return;
              const bounds = mapRef.current.getBounds();
              const currentZoom = mapRef.current.getZoom();
              if (bounds && currentZoom) {
                const ne = bounds.getNorthEast();
                const sw = bounds.getSouthWest();
                onBoundsChanged({
                  minLng: sw.lng(),
                  minLat: sw.lat(),
                  maxLng: ne.lng(),
                  maxLat: ne.lat(),
                  zoom: currentZoom,
                });
              }
            }, 500); // ✅ Aumentado de 300ms a 500ms para reducir queries
          });
        }

        if (onReady && mapRef.current) onReady(mapRef.current);
      } catch (e: any) {
        setError(e?.message || 'No se pudo cargar el mapa');
      }
    };

    init();

    return () => {
      mounted = false;
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
        infoWindowRef.current = null;
      }
      if (clustererRef.current) {
        try {
          clustererRef.current.clearMarkers();
        } catch (e) {
          console.warn('Error clearing clusterer on unmount:', e);
        }
        clustererRef.current = null;
      }
      markerRefs.current.forEach(m => m.setMap(null));
      markerRefs.current.clear();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Limpiar clusterer anterior si existe - de forma segura
    if (clustererRef.current) {
      try {
        clustererRef.current.clearMarkers();
      } catch (e) {
        console.warn('Error clearing clusterer:', e);
      }
      clustererRef.current = null;
    }

    // Limpiar marcadores anteriores
    markerRefs.current.forEach(m => m.setMap(null));
    markerRefs.current.clear();

    if (!markers || markers.length === 0) {
      console.log('[BasicGoogleMap] No markers to render');
      return;
    }

    console.log('[BasicGoogleMap] Rendering markers count =', markers.length, markers.slice(0, 3));

    const bounds = new google.maps.LatLngBounds();
    
    // Crear info window si no existe
    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow();
    }
    
    // Crear nuevos marcadores
    for (const m of markers) {
      if (!m.id || m.lat == null || m.lng == null || isNaN(Number(m.lat)) || isNaN(Number(m.lng))) continue;
      
      const lat = Number(m.lat);
      const lng = Number(m.lng);
      
      // Formatear el precio para el label
      const priceLabel = m.price ? formatPrice(m.price, m.currency || 'MXN') : '';
      
      const marker = new google.maps.Marker({ 
        position: { lat, lng },
        animation: undefined,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#0ea5e9',
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
        label: {
          text: priceLabel,
          color: '#111827',
          fontSize: '13px',
          fontWeight: '600',
        },
        optimized: false,
      });
      
      // CRÍTICO: Asegurar que el marcador siempre se añade al mapa
      marker.setMap(map);
      
      // Guardar referencia del marcador con su id
      markerRefs.current.set(m.id, marker);
      
      // Agregar hover listeners al marcador
      marker.addListener('mouseover', () => {
        if (onMarkerHover) {
          onMarkerHover(m.id || null);
        }
      });
      
      marker.addListener('mouseout', () => {
        if (onMarkerHover) {
          onMarkerHover(null);
        }
      });
      
      // Agregar click listener al marcador
      marker.addListener('click', () => {
        if (!infoWindowRef.current) return;
        
        // Crear contenido del info window
        const formatPrice = (price: number) => {
          return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(price);
        };
        
        const imageUrl = m.images && m.images.length > 0 
          ? m.images[0].url 
          : '/placeholder.svg';
        
        const content = `
          <div style="max-width: 280px; font-family: system-ui, -apple-system, sans-serif;">
            <div style="margin-bottom: 12px; border-radius: 8px; overflow: hidden;">
              <img 
                src="${imageUrl}" 
                alt="${m.title || 'Propiedad'}"
                style="width: 100%; height: 160px; object-fit: cover; display: block;"
                onerror="this.src='/placeholder.svg'"
              />
            </div>
            <div style="padding: 0 4px;">
              <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1a1a1a; line-height: 1.3;">
                ${m.title || 'Propiedad'}
              </h3>
              <p style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #0ea5e9;">
                ${m.price ? formatPrice(m.price) : 'Precio no disponible'}
              </p>
              ${m.address ? `
                <p style="margin: 0 0 12px 0; font-size: 13px; color: #6b7280; line-height: 1.4;">
                  📍 ${m.address}
                </p>
              ` : ''}
              <div style="display: flex; gap: 16px; margin-bottom: 12px; font-size: 13px; color: #4b5563;">
                ${m.bedrooms ? `
                  <div style="display: flex; align-items: center; gap: 4px;">
                    <span>🛏️</span>
                    <span>${m.bedrooms} rec</span>
                  </div>
                ` : ''}
                ${m.bathrooms ? `
                  <div style="display: flex; align-items: center; gap: 4px;">
                    <span>🚿</span>
                    <span>${m.bathrooms} baños</span>
                  </div>
                ` : ''}
              </div>
              <div style="display: flex; gap: 8px; margin-top: 12px;">
                <button 
                  id="view-details-${m.id}"
                  style="
                    flex: 1;
                    padding: 8px 16px;
                    background: #0ea5e9;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.2s;
                  "
                  onmouseover="this.style.background='#0284c7'"
                  onmouseout="this.style.background='#0ea5e9'"
                >
                  Ver detalles
                </button>
                <button 
                  id="add-favorite-${m.id}"
                  style="
                    padding: 8px 12px;
                    background: #f3f4f6;
                    color: #374151;
                    border: none;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.2s;
                  "
                  onmouseover="this.style.background='#e5e7eb'"
                  onmouseout="this.style.background='#f3f4f6'"
                  title="Agregar a favoritos"
                >
                  ⭐
                </button>
              </div>
            </div>
          </div>
        `;
        
        infoWindowRef.current.setContent(content);
        infoWindowRef.current.open(map, marker);
        
        // Agregar event listeners después de que el info window se abra
        google.maps.event.addListenerOnce(infoWindowRef.current, 'domready', () => {
          const viewDetailsBtn = document.getElementById(`view-details-${m.id}`);
          const addFavoriteBtn = document.getElementById(`add-favorite-${m.id}`);
          
          if (viewDetailsBtn && onMarkerClick) {
            viewDetailsBtn.addEventListener('click', () => {
              onMarkerClick(m.id || '');
            });
          }
          
          if (addFavoriteBtn && onFavoriteClick) {
            addFavoriteBtn.addEventListener('click', () => {
              onFavoriteClick(m.id || '');
            });
          }
        });
      });
      
      bounds.extend(marker.getPosition()!);
    }
    
    // Convertir Map a Array para el clusterer
    const markerArray = Array.from(markerRefs.current.values());

    // Si clustering está habilitado, crear el clusterer
    // Esperar a que el mapa esté completamente listo antes de crear el clusterer
    if (enableClustering && markerArray.length > 0) {
      // Usar idle event para asegurar que el mapa está completamente inicializado
      const createClusterer = () => {
        if (!mapRef.current) return;
        
        try {
          clustererRef.current = new MarkerClusterer({
            map: mapRef.current,
            markers: markerArray,
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
        } catch (e) {
          console.error('Error creating clusterer:', e);
          // Fallback: agregar marcadores directamente
          const mapInstance = mapRef.current;
          if (mapInstance) {
            markerArray.forEach(marker => marker.setMap(mapInstance));
          }
        }
      };

      // Intentar crear inmediatamente y añadir un fallback en 'idle' por si el mapa aún no está listo
      createClusterer();
      if (!clustererRef.current && mapRef.current) {
        google.maps.event.addListenerOnce(mapRef.current, 'idle', createClusterer);
      }
    } else {
      // Si clustering no está habilitado, agregar marcadores directamente al mapa
      const mapInstance = mapRef.current;
      if (mapInstance) {
        markerArray.forEach(marker => marker.setMap(mapInstance));
      }
    }

    // Ajustar vista del mapa a los marcadores solo si no está deshabilitado
    if (!disableAutoFit) {
      const mapInstance = mapRef.current;
      if (mapInstance) {
        if (markerArray.length > 1) {
          mapInstance.fitBounds(bounds);
        } else if (markerArray.length === 1) {
          mapInstance.setCenter(markerArray[0].getPosition()!);
        }
      }
    }
  }, [markers, enableClustering, onMarkerClick, onFavoriteClick, disableAutoFit, onMarkerHover]);
  
  // Efecto para resaltar el marcador cuando se hace hover sobre una tarjeta
  useEffect(() => {
    markerRefs.current.forEach((marker, markerId) => {
      if (markerId === hoveredMarkerId) {
        // Aplicar animación bounce sin cambiar el ícono
        marker.setAnimation(google.maps.Animation.BOUNCE);
        marker.setZIndex(1000);
      } else {
        // Restaurar el marcador a su estado normal
        marker.setAnimation(null);
        marker.setZIndex(undefined);
      }
    });
  }, [hoveredMarkerId]);

  // Centrar el mapa cuando cambie la prop center
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;
    
    map.panTo(center);
    
    // Solo ajustar zoom si disableAutoFit está activo
    if (disableAutoFit) {
      map.setZoom(zoom);
    } else {
      // Ajustar zoom si está muy alejado
      const currentZoom = map.getZoom();
      if (currentZoom && currentZoom < 14) {
        map.setZoom(14);
      }
    }
  }, [center, zoom, disableAutoFit]);

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
