/// <reference types="google.maps" />
import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/lib/loadGoogleMaps';
import { MarkerClusterer, GridAlgorithm } from '@googlemaps/markerclusterer';
import { useCurrencyConversion } from '@/hooks/useCurrencyConversion';
import { monitoring } from '@/lib/monitoring';

// ✅ Factory function para crear la clase CustomPropertyOverlay después de que google esté disponible
function createCustomPropertyOverlay() {
  return class CustomPropertyOverlay extends google.maps.OverlayView {
    private position: google.maps.LatLng;
    private containerDiv: HTMLDivElement | null = null;
    private priceText: string;
    private propertyId: string;
    private isHovered: boolean = false;
    private onClick: (id: string) => void;
    private onMouseOver: (id: string) => void;
    private onMouseOut: () => void;

    constructor(
      position: google.maps.LatLng,
      priceText: string,
      propertyId: string,
      onClick: (id: string) => void,
      onMouseOver: (id: string) => void,
      onMouseOut: () => void
    ) {
      super();
      this.position = position;
      this.priceText = priceText;
      this.propertyId = propertyId;
      this.onClick = onClick;
      this.onMouseOver = onMouseOver;
      this.onMouseOut = onMouseOut;
    }

    onAdd() {
      const div = document.createElement('div');
      div.style.position = 'absolute';
      div.style.cursor = 'pointer';
      div.style.userSelect = 'none';
      div.style.background = 'transparent';
      
      // Contenedor para centrar todo
      div.style.transform = 'translate(-50%, -100%)';
      
      // Crear el contenido: precio arriba, dot abajo
      div.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 2px; background: transparent;">
          ${this.priceText ? `
            <div style="
              background: white;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 13px;
              font-weight: 600;
              color: #111827;
              box-shadow: 0 2px 4px rgba(0,0,0,0.15);
              white-space: nowrap;
              border: 1px solid rgba(0,0,0,0.1);
            ">${this.priceText}</div>
          ` : ''}
          <div style="
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #e0332d;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(224, 51, 45, 0.4);
            transition: all 0.2s ease;
          "></div>
        </div>
      `;

      // Event listeners
      div.addEventListener('click', () => this.onClick(this.propertyId));
      div.addEventListener('mouseover', () => {
        this.isHovered = true;
        this.onMouseOver(this.propertyId);
        this.updateStyle();
      });
      div.addEventListener('mouseout', () => {
        this.isHovered = false;
        this.onMouseOut();
        this.updateStyle();
      });

      this.containerDiv = div;
      const panes = this.getPanes();
      panes?.overlayMouseTarget.appendChild(div);
    }

    draw() {
      if (!this.containerDiv) return;
      
      const overlayProjection = this.getProjection();
      const pos = overlayProjection.fromLatLngToDivPixel(this.position);
      
      if (pos) {
        this.containerDiv.style.left = pos.x + 'px';
        this.containerDiv.style.top = pos.y + 'px';
      }
    }

    onRemove() {
      if (this.containerDiv) {
        this.containerDiv.parentNode?.removeChild(this.containerDiv);
        this.containerDiv = null;
      }
    }

    setHovered(hovered: boolean) {
      this.isHovered = hovered;
      this.updateStyle();
    }

    private updateStyle() {
      if (!this.containerDiv) return;
      
      const wrapper = this.containerDiv.firstElementChild as HTMLElement | null;
      const dot = wrapper?.lastElementChild as HTMLElement | null;
      if (dot) {
        if (this.isHovered) {
          dot.style.background = '#b8281f';
          dot.style.transform = 'scale(1.15)';
          dot.style.boxShadow = '0 3px 10px rgba(184, 40, 31, 0.5)';
          dot.style.transition = 'all 0.2s ease';
        } else {
          dot.style.background = '#e0332d';
          dot.style.transform = 'scale(1)';
          dot.style.boxShadow = '0 2px 8px rgba(224, 51, 45, 0.4)';
          dot.style.transition = 'all 0.2s ease';
        }
      }
    }

    getPosition() {
      return this.position;
    }
  };
}

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
  hoveredPropertyCoords?: { lat: number; lng: number } | null;
  onMarkerHover?: (markerId: string | null) => void;
  onBoundsChanged?: (bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number; zoom: number }) => void;
  onMapError?: (error: string) => void;
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
  hoveredPropertyCoords = null,
  onMarkerHover,
  onBoundsChanged,
  onMapError,
}: BasicGoogleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlayRefs = useRef<Map<string, google.maps.OverlayView & { setHovered: (hovered: boolean) => void }>>(new Map());
  const invisibleMarkerRefs = useRef<Map<string, google.maps.Marker>>(new Map());
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number | null>(null);
  const { formatPrice } = useCurrencyConversion();

  // Helper para formatear precio abreviado según zoom
  const formatShortPrice = (price: number, currency: string = 'MXN') => {
    const symbol = currency === 'MXN' ? '$' : '$';
    
    if (price >= 1_000_000) {
      const millions = price / 1_000_000;
      return `${symbol}${millions.toFixed(1)}M`;
    } else if (price >= 1_000) {
      const thousands = price / 1_000;
      return `${symbol}${thousands.toFixed(0)}k`;
    } else {
      return `${symbol}${price}`;
    }
  };

  // Mantener callbacks estables sin re-crear marcadores
  const onMarkerClickRef = useRef<((id: string) => void) | undefined>(onMarkerClick);
  const onFavoriteClickRef = useRef<((id: string) => void) | undefined>(onFavoriteClick);
  const onMarkerHoverRef = useRef<((id: string | null) => void) | undefined>(onMarkerHover);
  useEffect(() => { onMarkerClickRef.current = onMarkerClick; }, [onMarkerClick]);
  useEffect(() => { onFavoriteClickRef.current = onFavoriteClick; }, [onFavoriteClick]);
  useEffect(() => { onMarkerHoverRef.current = onMarkerHover; }, [onMarkerHover]);

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
              const zoom = mapRef.current.getZoom();
              
              // Actualizar estado de zoom para re-renderizar markers
              if (zoom !== undefined) {
                setCurrentZoom(zoom);
              }
              
              if (bounds && zoom) {
                const ne = bounds.getNorthEast();
                const sw = bounds.getSouthWest();
                onBoundsChanged({
                  minLng: sw.lng(),
                  minLat: sw.lat(),
                  maxLng: ne.lng(),
                  maxLat: ne.lat(),
                  zoom: zoom,
                });
              }
            }, 500); // ✅ FASE 3: Aumentado de 200ms a 500ms para reducir requests
          });
        }

        // Inicializar currentZoom
        const initialZoom = mapRef.current.getZoom();
        if (initialZoom !== undefined) {
          setCurrentZoom(initialZoom);
        }

        if (onReady && mapRef.current) onReady(mapRef.current);
      } catch (e: any) {
        const errorMessage = e?.message || 'No se pudo cargar el mapa';
        setError(errorMessage);
        onMapError?.(errorMessage);
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
          monitoring.debug('Error clearing clusterer on unmount', { error: e });
        }
        clustererRef.current = null;
      }
      overlayRefs.current.forEach(o => o.setMap(null));
      overlayRefs.current.clear();
      invisibleMarkerRefs.current.forEach(m => m.setMap(null));
      invisibleMarkerRefs.current.clear();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof google === 'undefined') return;

    // Obtener zoom actual
    const zoom = currentZoom ?? map.getZoom() ?? 12;

    // Crear la clase CustomPropertyOverlay ahora que google está disponible
    const CustomPropertyOverlay = createCustomPropertyOverlay();

    // ✅ FASE 4: Iniciar medición de performance
    const renderStartTime = performance.now();

    // Limpiar clusterer anterior si existe - de forma segura
    if (clustererRef.current) {
      try {
        clustererRef.current.clearMarkers();
      } catch (e) {
        monitoring.debug('Error clearing clusterer', { error: e });
      }
      clustererRef.current = null;
    }

    // Limpiar overlays y marcadores invisibles anteriores
    overlayRefs.current.forEach(o => o.setMap(null));
    overlayRefs.current.clear();
    invisibleMarkerRefs.current.forEach(m => m.setMap(null));
    invisibleMarkerRefs.current.clear();

    if (!markers || markers.length === 0) {
      monitoring.debug('[BasicGoogleMap] Sin marcadores para renderizar');
      return;
    }

    // Reglas de visualización según zoom
    const showFullPriceLabel = zoom >= 14;
    const showShortPriceLabel = zoom >= 11 && zoom < 14;
    const hidePriceLabel = zoom < 11;
    
    // ✅ FASE 1: Clustering activo hasta zoom 15 (antes 18)
    const clusteringActive = enableClustering && zoom < 15;

    const bounds = new google.maps.LatLngBounds();
    
    // Crear info window si no existe
    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow();
    }
    
    // ✅ Crear marcadores según el modo (clustering vs individual)
    for (const m of markers) {
      if (!m.id || m.lat == null || m.lng == null || isNaN(Number(m.lat)) || isNaN(Number(m.lng))) continue;
      
      const lat = Number(m.lat);
      const lng = Number(m.lng);
      const position = new google.maps.LatLng(lat, lng);
      
      if (clusteringActive) {
        // ✅ MODO CLUSTERING: Solo crear marcadores invisibles para el clusterer
        const invisibleMarker = new google.maps.Marker({
          position,
          map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 0, // Invisible
            fillOpacity: 0,
            strokeOpacity: 0,
          },
          optimized: false,
        });
        invisibleMarkerRefs.current.set(m.id, invisibleMarker);
      } else {
        // ✅ MODO INDIVIDUAL: Crear overlays personalizados con precio
        let priceText = '';
        if (!hidePriceLabel && m.price) {
          if (showFullPriceLabel) {
            priceText = formatPrice(m.price, m.currency || 'MXN');
          } else if (showShortPriceLabel) {
            priceText = formatShortPrice(m.price, m.currency || 'MXN');
          }
        }

        const overlay = new CustomPropertyOverlay(
          position,
          priceText,
          m.id,
          (id) => onMarkerClickRef.current?.(id),
          (id) => onMarkerHoverRef.current?.(id),
          () => onMarkerHoverRef.current?.(null)
        );
        overlay.setMap(map);
        overlayRefs.current.set(m.id, overlay);
      }
      
      bounds.extend(position);
    }
    
    // Convertir Map a Array para el clusterer
    const markerArray = Array.from(invisibleMarkerRefs.current.values());

    // ✅ Si clustering está habilitado Y activo en este zoom, crear el clusterer
    if (clusteringActive && markerArray.length > 0) {
      const createClusterer = () => {
        if (!mapRef.current) return;
        
        try {
          // ✅ FASE 4: Métricas de clustering
          const startTime = performance.now();
          
          clustererRef.current = new MarkerClusterer({
            map: mapRef.current,
            markers: markerArray,
            algorithm: new GridAlgorithm({ 
              maxZoom: 15,        // ✅ FASE 2: Reducido de 18 a 15
              gridSize: 60,       // ✅ FASE 4: Más agresivo (antes 80) para agrupar más rápido
              maxDistance: 30000, // ✅ FASE 4: Reducido de 40000 a 30000 para clusters más compactos
            }),
            onClusterClick: (_, cluster, map) => {
              // ✅ FASE 4: Al hacer clic en cluster, zoom in suave
              map.setCenter(cluster.position);
              map.setZoom(Math.min((map.getZoom() || 5) + 3, 15));
            },
            renderer: {
              render: ({ count, position }) => {
                // Mejorar escala y colores para densidades altas
                let color: string;
                let scale: number;
                let fontSize: string;
                
                if (count > 100) {
                  color = '#dc2626'; // Rojo intenso
                  scale = 55;
                  fontSize = '16px';
                } else if (count > 50) {
                  color = '#ea580c'; // Naranja intenso
                  scale = 45;
                  fontSize = '15px';
                } else if (count > 20) {
                  color = '#f59e0b'; // Amarillo/naranja
                  scale = 35;
                  fontSize = '14px';
                } else if (count > 10) {
                  color = '#3b82f6'; // Azul
                  scale = 28;
                  fontSize = '13px';
                } else {
                  color = '#6366f1'; // Índigo
                  scale = 22;
                  fontSize = '12px';
                }
                
                return new google.maps.Marker({
                  position,
                  icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: color,
                    fillOpacity: 0.85,
                    strokeColor: '#ffffff',
                    strokeWeight: 3,
                    scale,
                  },
                  label: {
                    text: count > 999 ? '999+' : String(count),
                    color: '#ffffff',
                    fontSize,
                    fontWeight: 'bold',
                  },
                  zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count,
                });
              },
            },
          });
          
          // ✅ FASE 4: Log de métricas de clustering
          const endTime = performance.now();
          monitoring.debug('[BasicGoogleMap] Clustering creado', {
            markers: markerArray.length,
            timeMs: (endTime - startTime).toFixed(2),
            zoom,
          });
        } catch (e) {
          monitoring.warn('Error creating clusterer', {
            component: 'BasicGoogleMap',
            error: e,
          });
        }
      };

      createClusterer();
      if (!clustererRef.current && mapRef.current) {
        google.maps.event.addListenerOnce(mapRef.current, 'idle', createClusterer);
      }
    }

    // Ajustar vista del mapa a los marcadores solo si no está deshabilitado
    if (!disableAutoFit) {
      const mapInstance = mapRef.current;
      if (mapInstance && markers.length > 0) {
        if (markers.length > 1) {
          mapInstance.fitBounds(bounds);
        } else if (markers.length === 1) {
          const firstMarker = markers[0];
          if (firstMarker.lat && firstMarker.lng) {
            mapInstance.setCenter(new google.maps.LatLng(Number(firstMarker.lat), Number(firstMarker.lng)));
          }
        }
      }
    }

    // ✅ FASE 4: Log de métricas finales de renderizado
    const renderEndTime = performance.now();
    const individualMarkers = clusteringActive ? 0 : markers.length;
    const clusteredMarkers = clusteringActive ? markers.length : 0;
    
    monitoring.debug('[BasicGoogleMap] Renderizado completo', {
      totalMarkers: markers.length,
      individualMarkers,
      clusteredMarkers,
      clusteringActive,
      zoom,
      renderTimeMs: (renderEndTime - renderStartTime).toFixed(2),
    });

    // ✅ FASE 4: Alerta si se renderizan muchos marcadores individuales
    if (!clusteringActive && markers.length > 100) {
      monitoring.warn('[BasicGoogleMap] Renderizando muchos marcadores individuales', {
        count: markers.length,
        zoom,
        recommendation: 'Considera reducir límite de propiedades o ajustar clustering threshold',
      });
    }
  }, [markers, enableClustering, disableAutoFit, currentZoom]);
  
  // Efecto para resaltar el overlay cuando se hace hover sobre una tarjeta
  useEffect(() => {
    overlayRefs.current.forEach((overlay, overlayId) => {
      overlay.setHovered(overlayId === hoveredMarkerId);
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

  // Efecto para hacer zoom y centrar cuando hay hover desde la lista
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hoveredPropertyCoords) return;
    
    const { lat, lng } = hoveredPropertyCoords;
    
    // Verificar que las coordenadas sean válidas
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;
    
    // Obtener zoom actual
    const currentZoom = map.getZoom() ?? 12;
    
    // Si el zoom es muy bajo, acercarse más
    const targetZoom = currentZoom < 15 ? 15 : currentZoom;
    
    // Animar hacia la propiedad con hover
    map.panTo({ lat, lng });
    
    // Ajustar zoom si es necesario
    if (currentZoom < 15) {
      setTimeout(() => {
        map.setZoom(targetZoom);
      }, 300); // Pequeño delay para que la animación de pan se vea bien
    }
    
    monitoring.debug('[BasicGoogleMap] Zoom to hovered property', {
      lat,
      lng,
      currentZoom,
      targetZoom,
    });
  }, [hoveredPropertyCoords]);

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
