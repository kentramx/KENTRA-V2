/// <reference types="google.maps" />
import React, { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/lib/loadGoogleMaps';
import { Loader2, AlertCircle, MapPin, Map as MapIcon, Satellite } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { MarkerClusterer } from '@googlemaps/markerclusterer';

interface Property {
  id: string;
  title: string;
  price: number;
  type: string;
  listing_type: string;
  address: string;
  municipality: string;
  state: string;
  lat?: number;
  lng?: number;
  created_at?: string;
  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  images?: { url: string }[];
}

interface InteractivePropertyMapProps {
  properties: Property[];
  onPropertySelect?: (property: Property) => void;
  onLocationSelect?: (location: {
    address: string;
    municipality: string;
    state: string;
    lat: number;
    lng: number;
  }) => void;
  height?: string;
  defaultCenter?: { lat: number; lng: number };
  defaultZoom?: number;
  hoveredPropertyId?: string | null;
  showLocationPicker?: boolean;
}

export const InteractivePropertyMap = ({
  properties,
  onPropertySelect,
  onLocationSelect,
  height = '500px',
  defaultCenter = { lat: 23.6345, lng: -102.5528 },
  defaultZoom = 5,
  hoveredPropertyId,
  showLocationPicker = false,
}: InteractivePropertyMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const locationMarkerRef = useRef<google.maps.Marker | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');

  // Helper para verificar si una propiedad es reciente
  const isRecentProperty = (createdAt?: string): boolean => {
    if (!createdAt) return false;
    const propertyDate = new Date(createdAt);
    const now = new Date();
    const daysDiff = (now.getTime() - propertyDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 7;
  };

  // Obtener color según tipo de propiedad
  const getPropertyTypeColor = (type: string): string => {
    const colorMap: Record<string, string> = {
      casa: '#3B82F6',           // Azul - Casas
      departamento: '#10B981',   // Verde - Departamentos
      terreno: '#92400E',        // Café/Marrón - Terrenos
      oficina: '#F59E0B',        // Naranja - Oficinas
      local: '#F59E0B',          // Naranja - Locales comerciales
      bodega: '#6B7280',         // Gris - Bodegas
      edificio: '#8B5CF6',       // Púrpura - Edificios
      rancho: '#84CC16',         // Lima - Ranchos
    };
    return colorMap[type] || '#3B82F6'; // Azul por defecto
  };

  // Generar icono SVG con animación de pulso para propiedades recientes
  const getPropertyIcon = (type: string, color: string, isRecent: boolean): string => {
    const icons: Record<string, string> = {
      casa: `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>`,
      departamento: `<rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line>`,
      terreno: `<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>`,
      oficina: `<rect x="2" y="3" width="20" height="14" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line>`,
      local: `<path d="M3 3h18v18H3z"></path><path d="M3 9h18"></path><path d="M9 21V9"></path>`,
      bodega: `<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><path d="m3.3 7 8.7 5 8.7-5"></path><path d="M12 22V12"></path>`,
      edificio: `<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"></path><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"></path><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"></path><path d="M10 6h4"></path><path d="M10 10h4"></path><path d="M10 14h4"></path><path d="M10 18h4"></path>`,
      rancho: `<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>`,
    };
    
    const iconPath = icons[type] || icons['casa'];
    
    const pulseRing = isRecent ? `
      <radialGradient id="pulse-${type}">
        <stop offset="0%" style="stop-color:${color};stop-opacity:0" />
        <stop offset="100%" style="stop-color:${color};stop-opacity:0.4" />
      </radialGradient>
      <circle cx="12" cy="12" r="16" fill="url(#pulse-${type})" opacity="0.7">
        <animate attributeName="r" from="11" to="18" dur="1.5s" repeatCount="indefinite"/>
        <animate attributeName="opacity" from="0.7" to="0" dur="1.5s" repeatCount="indefinite"/>
      </circle>
    ` : '';
    
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <defs>
          <filter id="shadow-${type}" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
            <feOffset dx="0" dy="2" result="offsetblur"/>
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.5"/>
            </feComponentTransfer>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <radialGradient id="grad-${type}">
            <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${color};stop-opacity:0.9" />
          </radialGradient>
          ${pulseRing}
        </defs>
        ${isRecent ? pulseRing.split('</radialGradient>')[1] : ''}
        <circle cx="12" cy="12" r="11" fill="url(#grad-${type})" filter="url(#shadow-${type})" opacity="0.95"/>
        <circle cx="12" cy="12" r="11" fill="none" stroke="white" stroke-width="2.5" opacity="0.9"/>
        <g transform="scale(0.65) translate(6, 6)">
          ${iconPath}
        </g>
      </svg>
    `;
  };

  // Formatear precio
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  // Crear marcador de propiedad
  const createMarker = (property: Property, map: google.maps.Map): google.maps.Marker | null => {
    if (!property.lat || !property.lng) return null;

    const typeColor = getPropertyTypeColor(property.type);
    const isRecent = isRecentProperty(property.created_at);
    const iconSvg = getPropertyIcon(property.type, typeColor, isRecent);
    
    const svgBlob = new Blob([iconSvg], { type: 'image/svg+xml' });
    const svgUrl = URL.createObjectURL(svgBlob);
    
    const marker = new google.maps.Marker({
      map,
      position: { lat: Number(property.lat), lng: Number(property.lng) },
      title: property.title,
      icon: {
        url: svgUrl,
        scaledSize: new google.maps.Size(44, 44),
        anchor: new google.maps.Point(22, 44),
      },
      label: {
        text: new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: 'MXN',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
          notation: 'compact',
          compactDisplay: 'short'
        }).format(property.price).replace('MXN', '').trim(),
        color: typeColor,
        fontSize: '11px',
        fontWeight: 'bold',
        className: 'marker-price-label'
      },
      optimized: false,
    });

    // Crear contenido del InfoWindow
    const createInfoWindowContent = (prop: Property) => {
      const imageUrl = prop.images && prop.images.length > 0 
        ? prop.images[0].url 
        : '/src/assets/property-placeholder.jpg';
      
      const features = [];
      if (prop.bedrooms) features.push(`${prop.bedrooms} rec`);
      if (prop.bathrooms) features.push(`${prop.bathrooms} baños`);
      if (prop.parking) features.push(`${prop.parking} est`);

      const isVenta = prop.listing_type === 'renta';
      const badgeColor = isVenta ? '#3b82f6' : '#10b981';
      const badgeBgColor = isVenta ? 'rgba(59, 130, 246, 0.9)' : 'rgba(16, 185, 129, 0.9)';
      const badgeIcon = isVenta ? '📈' : '🏷️';
      const badgeText = isVenta ? 'En Renta' : 'En Venta';

      return `
        <div style="min-width: 280px; max-width: 320px; font-family: system-ui, -apple-system, sans-serif;">
          <div style="position: relative;">
            <img 
              src="${imageUrl}" 
              alt="${prop.title}"
              style="width: 100%; height: 160px; object-fit: cover; border-radius: 8px 8px 0 0; margin: -16px -16px 12px -16px;"
            />
            <div style="
              position: absolute;
              top: -4px;
              left: -4px;
              background: ${badgeBgColor};
              color: white;
              padding: 6px 12px;
              border-radius: 6px;
              font-size: 13px;
              font-weight: 600;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
              backdrop-filter: blur(4px);
              border: 2px solid rgba(255,255,255,0.3);
              display: inline-flex;
              align-items: center;
              gap: 4px;
            ">
              <span>${badgeIcon}</span>
              <span>${badgeText}</span>
            </div>
          </div>
          <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1a1a1a; line-height: 1.3;">
            ${prop.title}
          </h3>
          <p style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #0EA5E9;">
            ${formatPrice(prop.price)}
          </p>
          ${features.length > 0 ? `
            <div style="display: flex; gap: 12px; margin: 0 0 12px 0; font-size: 14px; color: #666;">
              ${features.join(' · ')}
            </div>
          ` : ''}
          <p style="margin: 0 0 12px 0; font-size: 13px; color: #666; display: flex; align-items: center; gap: 4px;">
            <span style="color: #0EA5E9;">📍</span>
            ${prop.municipality}, ${prop.state}
          </p>
          <a 
            href="/propiedad/${prop.id}"
            style="display: block; width: 100%; padding: 10px 16px; background: #0EA5E9; color: white; text-align: center; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px; transition: background 0.2s;"
            onmouseover="this.style.background='#0284C7'"
            onmouseout="this.style.background='#0EA5E9'"
          >
            Ver detalles
          </a>
        </div>
      `;
    };

    marker.addListener('click', () => {
      if (onPropertySelect) {
        onPropertySelect(property);
      }
      
      marker.setAnimation(google.maps.Animation.BOUNCE);
      setTimeout(() => marker.setAnimation(null), 2100);
      
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
      }

      infoWindowRef.current = new google.maps.InfoWindow({
        content: createInfoWindowContent(property),
        maxWidth: 320,
      });

      infoWindowRef.current.open(map, marker);
    });

    marker.addListener('mouseover', () => {
      marker.setAnimation(google.maps.Animation.BOUNCE);
    });

    marker.addListener('mouseout', () => {
      marker.setAnimation(null);
    });

    return marker;
  };

  // Inicializar mapa
  useEffect(() => {
    let isMounted = true;

    const initMap = async () => {
      try {
        await loadGoogleMaps();

        if (!isMounted || !mapRef.current) return;

        const map = new google.maps.Map(mapRef.current, {
          center: defaultCenter,
          zoom: defaultZoom,
          clickableIcons: false,
          gestureHandling: 'greedy',
          zoomControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          rotateControl: false,
          scaleControl: false,
          panControl: false,
          mapTypeId: mapType,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }],
            },
          ],
        });

        mapInstanceRef.current = map;
        geocoderRef.current = new google.maps.Geocoder();

        // Si showLocationPicker está habilitado, agregar listener de clic
        if (showLocationPicker && onLocationSelect) {
          map.addListener('click', async (event: google.maps.MapMouseEvent) => {
            if (!event.latLng || !geocoderRef.current) return;

            const lat = event.latLng.lat();
            const lng = event.latLng.lng();

            // Actualizar marcador de ubicación
            if (locationMarkerRef.current) {
              locationMarkerRef.current.setPosition({ lat, lng });
            } else {
              locationMarkerRef.current = new google.maps.Marker({
                map,
                position: { lat, lng },
                title: 'Ubicación seleccionada',
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: '#ef4444',
                  fillOpacity: 1,
                  strokeColor: '#fff',
                  strokeWeight: 2,
                },
              });
            }

            // Geocodificar
            setIsGeocodingAddress(true);
            
            try {
              const response = await geocoderRef.current.geocode({ location: { lat, lng } });

              if (response.results && response.results.length > 0) {
                const place = response.results[0];
                
                let municipality = '';
                let state = '';

                place.address_components?.forEach((component) => {
                  if (component.types.includes('locality')) {
                    municipality = component.long_name;
                  }
                  if (component.types.includes('administrative_area_level_1')) {
                    state = component.long_name;
                  }
                });

                onLocationSelect({
                  address: place.formatted_address || '',
                  municipality,
                  state,
                  lat,
                  lng,
                });
              }
            } catch (error) {
              console.error('Error geocoding:', error);
            } finally {
              setIsGeocodingAddress(false);
            }
          });
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Error loading map:', err);
        setError('No se pudo cargar el mapa');
        setIsLoading(false);
      }
    };

    initMap();

    return () => {
      isMounted = false;
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
      }
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current.clear();
      if (locationMarkerRef.current) {
        locationMarkerRef.current.setMap(null);
      }
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
      }
    };
  }, [defaultCenter, defaultZoom, showLocationPicker, onLocationSelect, mapType]);

  // Actualizar marcadores cuando cambian las propiedades
  useEffect(() => {
    if (!mapInstanceRef.current || isLoading) return;

    // Limpiar marcadores existentes
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
    }
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current.clear();

    // Crear nuevos marcadores
    const newMarkers: google.maps.Marker[] = [];
    
    properties.forEach((property) => {
      const marker = createMarker(property, mapInstanceRef.current!);
      if (marker) {
        markersRef.current.set(property.id, marker);
        newMarkers.push(marker);
      }
    });

    // Aplicar clustering
    if (newMarkers.length > 0) {
      clustererRef.current = new MarkerClusterer({
        map: mapInstanceRef.current,
        markers: newMarkers,
      });

      // Ajustar vista para mostrar todos los marcadores
      const bounds = new google.maps.LatLngBounds();
      newMarkers.forEach((marker) => {
        const position = marker.getPosition();
        if (position) bounds.extend(position);
      });
      
      if (newMarkers.length > 0) {
        mapInstanceRef.current.fitBounds(bounds);
        const currentZoom = mapInstanceRef.current.getZoom();
        if (currentZoom && currentZoom > 15) {
          mapInstanceRef.current.setZoom(15);
        }
      }
    }
  }, [properties, isLoading, mapType]);

  // Efecto hover desde lista de propiedades
  useEffect(() => {
    if (!hoveredPropertyId || !markersRef.current.has(hoveredPropertyId)) return;

    const marker = markersRef.current.get(hoveredPropertyId);
    if (marker) {
      marker.setAnimation(google.maps.Animation.BOUNCE);
      return () => {
        marker.setAnimation(null);
      };
    }
  }, [hoveredPropertyId]);

  // Botón de mi ubicación
  const handleMyLocation = () => {
    if (!navigator.geolocation || !mapInstanceRef.current) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        mapInstanceRef.current?.setCenter({ lat, lng });
        mapInstanceRef.current?.setZoom(12);
      },
      (error) => {
        console.error('Geolocation error:', error);
      }
    );
  };

  if (error) {
    return (
      <Alert variant="destructive" className="my-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="relative">
      <div
        ref={mapRef}
        style={{ height, width: '100%' }}
        className="rounded-lg overflow-hidden border border-border shadow-lg"
      />
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
          <div className="text-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Cargando mapa...</p>
          </div>
        </div>
      )}

      {isGeocodingAddress && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-border flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm font-medium">Obteniendo dirección...</span>
        </div>
      )}

      {!isLoading && (
        <>
          <div className="absolute top-4 right-4 space-y-2">
            <Button
              onClick={() => setMapType(mapType === 'roadmap' ? 'satellite' : 'roadmap')}
              size="icon"
              variant="secondary"
              className="shadow-lg"
              title={mapType === 'roadmap' ? 'Vista Satélite' : 'Vista Mapa'}
            >
              {mapType === 'roadmap' ? (
                <Satellite className="h-4 w-4" />
              ) : (
                <MapIcon className="h-4 w-4" />
              )}
            </Button>
            <Button
              onClick={handleMyLocation}
              size="icon"
              variant="secondary"
              className="shadow-lg"
              title="Usar mi ubicación"
            >
              <MapPin className="h-4 w-4" />
            </Button>
          </div>
          
          {showLocationPicker && (
            <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg border border-border">
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <MapPin className="h-3 w-3" />
                Haz clic en el mapa para seleccionar ubicación
              </p>
            </div>
          )}

          {!showLocationPicker && properties.length > 0 && (
            <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg border border-border">
              <p className="text-xs text-muted-foreground">
                {properties.length} propiedades en el mapa
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
