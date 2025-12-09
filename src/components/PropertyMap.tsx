/**
 * PropertyMap - Mapa simple para mostrar una propiedad individual
 * 
 * Usado en la página de detalle de propiedad y en el Sheet de detalle.
 */

import React, { useRef, useEffect } from 'react';
import { MapboxBaseMap } from '@/components/MapboxBaseMap';
import { mapboxgl, MAPBOX_TOKEN } from '@/lib/mapboxClient';
import { cn } from '@/lib/utils';

interface PropertyMapProps {
  lat?: number | null;
  lng?: number | null;
  address?: string;
  className?: string;
}

export const PropertyMap: React.FC<PropertyMapProps> = ({
  lat,
  lng,
  address,
  className,
}) => {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  // No renderizar si no hay coordenadas
  if (!lat || !lng) {
    return null;
  }

  // Callback cuando el mapa está listo
  const handleMapReady = (map: mapboxgl.Map) => {
    mapRef.current = map;

    // Limpiar marker anterior si existe
    if (markerRef.current) {
      markerRef.current.remove();
    }

    // Crear marker para la propiedad
    const marker = new mapboxgl.Marker({
      color: 'hsl(66, 17%, 31%)', // primary color
    })
      .setLngLat([lng, lat])
      .addTo(map);

    // Agregar popup con dirección si existe
    if (address) {
      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: false,
        className: 'property-map-popup',
      }).setHTML(`
        <div class="p-2">
          <p class="text-sm font-medium">${address}</p>
        </div>
      `);

      marker.setPopup(popup);
    }

    markerRef.current = marker;
  };

  return (
    <div className={cn("h-72 w-full rounded-lg border border-border overflow-hidden", className)}>
      <MapboxBaseMap
        initialCenter={{ lat, lng }}
        initialZoom={15}
        onMapReady={handleMapReady}
        className="h-full w-full"
      />
    </div>
  );
};

export default PropertyMap;
