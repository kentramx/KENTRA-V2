import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BasicGoogleMap from "@/components/BasicGoogleMap";

interface Property {
  id: string;
  title: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  lat: number | null;
  lng: number | null;
  address: string;
  state: string;
  municipality: string;
  type: string;
  listing_type: "venta" | "renta";
  images: { url: string; position: number }[];
}

const HomeMap = ({ height = "450px" }: { height?: string }) => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch de propiedades - IDÉNTICO a Buscar.tsx
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const { data, error } = await supabase
          .from('properties')
          .select(`
            id, title, price, bedrooms, bathrooms, parking, 
            lat, lng, address, state, municipality, type, listing_type,
            created_at, sqft, agent_id,
            images (url, position)
          `)
          .eq('status', 'activa')
          .order('position', { foreignTable: 'images', ascending: true })
          .limit(1000);

        if (error) throw error;

        const propertiesWithSortedImages = data?.map(property => ({
          ...property,
          type: property.type === 'local_comercial' ? 'local' : property.type,
          images: (property.images || []).sort((a: any, b: any) => a.position - b.position)
        })) as Property[] || [];

        setProperties(propertiesWithSortedImages);
      } catch (error) {
        console.error('Error fetching properties:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, []);

  // Creación de markers - IDÉNTICO a Buscar.tsx
  const mapMarkers = properties
    .filter(p => typeof p.lat === 'number' && typeof p.lng === 'number')
    .map(p => ({ 
      id: p.id, 
      lat: p.lat as number, 
      lng: p.lng as number,
      title: p.title,
      price: p.price,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      images: p.images,
      listing_type: p.listing_type,
      address: p.address,
    }));

  // Centro del mapa - IDÉNTICO a Buscar.tsx (sin filtros activos)
  const mapCenter = mapMarkers.length > 0
    ? { lat: 23.6345, lng: -102.5528 } // Centro geográfico de México
    : { lat: 23.6345, lng: -102.5528 };

  // Zoom del mapa - IDÉNTICO a Buscar.tsx (sin filtros = vista completa de México)
  const mapZoom = 5; // Vista completa de México

  const handleMarkerClick = (id: string) => {
    navigate(`/propiedad/${id}`);
  };

  const handleFavoriteClick = async (propertyId: string) => {
    // Esta función no se usa en Home, pero la dejamos para compatibilidad
    console.log('Favorite clicked:', propertyId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-muted/20" style={{ height }}>
        <p className="text-muted-foreground">Cargando mapa…</p>
      </div>
    );
  }

  if (mapMarkers.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-muted/20" style={{ height }}>
        <p className="text-muted-foreground">No hay propiedades para mostrar en el mapa</p>
      </div>
    );
  }

  return (
    <BasicGoogleMap
      center={mapCenter}
      zoom={mapZoom}
      markers={mapMarkers}
      height={height}
      className="h-full w-full"
      onMarkerClick={handleMarkerClick}
      onFavoriteClick={handleFavoriteClick}
      disableAutoFit={false}
      hoveredMarkerId={null}
    />
  );
};

export default HomeMap;
