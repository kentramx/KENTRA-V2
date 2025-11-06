import { useEffect, useState } from 'react';
import { APIProvider, Map, AdvancedMarker, InfoWindow } from '@vis.gl/react-google-maps';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Property {
  id: string;
  title: string;
  price: number;
  lat: number;
  lng: number;
  type: string;
  address: string;
  municipality: string;
  state: string;
  images?: Array<{ url: string }>;
}

interface PropertyMapProps {
  properties: Property[];
  center?: { lat: number; lng: number };
  zoom?: number;
}

const PropertyMap = ({ properties, center, zoom = 12 }: PropertyMapProps) => {
  const navigate = useNavigate();
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [mapCenter, setMapCenter] = useState(center || { lat: 20.6597, lng: -103.3496 }); // Guadalajara default

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (properties.length > 0 && !center) {
      // Calculate center from properties
      const validProperties = properties.filter(p => p.lat && p.lng);
      if (validProperties.length > 0) {
        const avgLat = validProperties.reduce((sum, p) => sum + p.lat, 0) / validProperties.length;
        const avgLng = validProperties.reduce((sum, p) => sum + p.lng, 0) / validProperties.length;
        setMapCenter({ lat: avgLat, lng: avgLng });
      }
    }
  }, [properties, center]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  if (!apiKey) {
    return (
      <Card className="p-4 text-center">
        <p className="text-muted-foreground">
          Configuración de Google Maps requerida
        </p>
      </Card>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <div className="w-full h-full min-h-[400px] rounded-lg overflow-hidden">
        <Map
          mapId="kentra-map"
          center={mapCenter}
          zoom={zoom}
          gestureHandling="greedy"
          disableDefaultUI={false}
        >
          {properties
            .filter(property => property.lat && property.lng)
            .map((property) => (
              <AdvancedMarker
                key={property.id}
                position={{ lat: property.lat, lng: property.lng }}
                onClick={() => setSelectedProperty(property)}
              >
                <div className="bg-primary text-primary-foreground px-3 py-2 rounded-full font-semibold shadow-lg cursor-pointer hover:scale-110 transition-transform">
                  {formatPrice(property.price)}
                </div>
              </AdvancedMarker>
            ))}

          {selectedProperty && (
            <InfoWindow
              position={{ lat: selectedProperty.lat, lng: selectedProperty.lng }}
              onCloseClick={() => setSelectedProperty(null)}
            >
              <div className="p-2 max-w-[250px]">
                {selectedProperty.images?.[0] && (
                  <img
                    src={selectedProperty.images[0].url}
                    alt={selectedProperty.title}
                    className="w-full h-32 object-cover rounded-md mb-2"
                  />
                )}
                <h3 className="font-semibold text-sm mb-1">{selectedProperty.title}</h3>
                <p className="text-xs text-muted-foreground mb-2">
                  {selectedProperty.address}
                </p>
                <p className="text-primary font-bold mb-2">
                  {formatPrice(selectedProperty.price)}
                </p>
                <Button
                  size="sm"
                  onClick={() => navigate(`/propiedad/${selectedProperty.id}`)}
                  className="w-full"
                >
                  Ver Detalles
                </Button>
              </div>
            </InfoWindow>
          )}
        </Map>
      </div>
    </APIProvider>
  );
};

export default PropertyMap;
