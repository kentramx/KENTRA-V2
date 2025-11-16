/**
 * ✅ Componente modular: Mapa de búsqueda
 * Extraído de Buscar.tsx
 */

import { memo } from 'react';
import BasicGoogleMap from '@/components/BasicGoogleMap';
import { ViewportBounds } from '@/hooks/usePropertiesViewport';

interface Property {
  id: string;
  lat: number | null;
  lng: number | null;
  title: string;
  price: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  images?: { url: string; position: number }[];
  listing_type: string;
  address: string;
}

interface SearchMapProps {
  properties: Property[];
  hoveredPropertyId: string | null;
  onMarkerClick: (propertyId: string) => void;
  onMarkerHover: (propertyId: string | null) => void;
  onBoundsChanged: (bounds: ViewportBounds) => void;
  height?: string;
}

const SearchMapComponent = ({
  properties,
  hoveredPropertyId,
  onMarkerClick,
  onMarkerHover,
  onBoundsChanged,
  height = 'calc(100vh - 8rem)'
}: SearchMapProps) => {
  const markers = properties
    .filter(p => p.lat != null && p.lng != null && !isNaN(Number(p.lat)) && !isNaN(Number(p.lng)))
    .map(p => ({
      id: p.id,
      lat: Number(p.lat),
      lng: Number(p.lng),
      title: p.title,
      price: p.price,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      images: p.images,
      listing_type: p.listing_type as 'venta' | 'renta',
      address: p.address,
      currency: 'MXN' as 'MXN' | 'USD',
    }));

  console.log('[SearchMap] markers', markers.length, markers.slice(0, 3));

  return (
    <BasicGoogleMap
      center={{ lat: 23.6345, lng: -102.5528 }}
      zoom={5}
      markers={markers}
      height={height}
      enableClustering={true}
      onMarkerClick={onMarkerClick}
      onBoundsChanged={onBoundsChanged}
      hoveredMarkerId={hoveredPropertyId}
      onMarkerHover={onMarkerHover}
    />
  );
};

export const SearchMap = memo(SearchMapComponent);
