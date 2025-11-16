import { Card } from '@/components/ui/card';
import BasicGoogleMap from '@/components/BasicGoogleMap';
import { ViewportBounds } from '@/hooks/usePropertiesViewport';

interface Property {
  id: string;
  title: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  lat: number | null;
  lng: number | null;
  address: string;
  state: string;
  municipality: string;
  type: 'casa' | 'departamento' | 'terreno' | 'oficina' | 'local' | 'bodega' | 'edificio' | 'rancho';
  listing_type: string;
  images: { url: string; position: number }[];
  created_at: string | null;
  sqft: number | null;
  agent_id: string;
  is_featured?: boolean;
}

interface SearchMapProps {
  properties: Property[];
  hoveredPropertyId: string | null;
  selectedProperty: string | null;
  onPropertyClick: (propertyId: string) => void;
  onPropertyHover: (propertyId: string | null) => void;
  onBoundsChange: (bounds: ViewportBounds) => void;
}

export const SearchMap = ({
  properties,
  hoveredPropertyId,
  selectedProperty,
  onPropertyClick,
  onPropertyHover,
  onBoundsChange,
}: SearchMapProps) => {
  // Convertir properties al formato de markers para BasicGoogleMap
  const markers = properties.map(property => ({
    id: property.id,
    lat: property.lat || 0,
    lng: property.lng || 0,
    title: property.title,
    price: property.price,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    images: property.images,
    listing_type: (property.listing_type === 'sale' ? 'venta' : 'renta') as 'venta' | 'renta',
    address: property.address,
  })).filter(m => m.lat && m.lng);

  return (
    <Card className="h-[600px] lg:h-full overflow-hidden">
      <BasicGoogleMap
        markers={markers}
        onMarkerClick={onPropertyClick}
        onMarkerHover={onPropertyHover}
        hoveredMarkerId={hoveredPropertyId}
        onBoundsChanged={(bounds) => {
          onBoundsChange({
            minLng: bounds.minLng,
            minLat: bounds.minLat,
            maxLng: bounds.maxLng,
            maxLat: bounds.maxLat,
            zoom: bounds.zoom,
          });
        }}
        enableClustering={true}
        disableAutoFit={false}
      />
    </Card>
  );
};
