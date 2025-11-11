import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BasicGoogleMap from "@/components/BasicGoogleMap";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

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
  const { user } = useAuth();
  const { toast } = useToast();
  const [hoveredProperty, setHoveredProperty] = useState<Property | null>(null);
  const searchCoordinates: { lat: number; lng: number } | null = null;
  const hasActiveFilters = false;

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

  // Centro del mapa y zoom - lógicos idénticos a Buscar.tsx
  const mapCenter = searchCoordinates
    ? searchCoordinates
    : (hoveredProperty && hoveredProperty.lat && hoveredProperty.lng
        ? { lat: hoveredProperty.lat, lng: hoveredProperty.lng }
        : (hasActiveFilters && mapMarkers.length > 0
            ? { lat: mapMarkers[0].lat, lng: mapMarkers[0].lng }
            : { lat: 23.6345, lng: -102.5528 }));

  const mapZoom = searchCoordinates 
    ? 12 
    : (hoveredProperty 
        ? 14 
        : (hasActiveFilters 
            ? 12 
            : 5));

  const handleMarkerClick = (id: string) => {
    navigate(`/propiedad/${id}`);
  };

  const handleFavoriteClick = async (propertyId: string) => {
    if (!user) {
      toast({
        title: 'Inicia sesión',
        description: 'Debes iniciar sesión para agregar favoritos',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Verificar si ya está en favoritos
      const { data: existing } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('property_id', propertyId)
        .maybeSingle();

      if (existing) {
        // Eliminar de favoritos
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('id', existing.id);

        if (error) throw error;

        toast({
          title: 'Eliminado de favoritos',
          description: 'La propiedad se eliminó de tus favoritos',
        });
      } else {
        // Agregar a favoritos
        const { error } = await supabase
          .from('favorites')
          .insert([{ user_id: user.id, property_id: propertyId }]);

        if (error) throw error;

        toast({
          title: '⭐ Agregado a favoritos',
          description: 'La propiedad se agregó a tus favoritos',
        });
      }
    } catch (error) {
      console.error('Error managing favorite:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar favoritos',
        variant: 'destructive',
      });
    }
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
    <div className="relative w-full" style={{ height }}>
      {/* Contador de resultados sobre el mapa */}
      <div className="absolute top-4 left-4 z-10 bg-background/95 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border">
        <p className="text-sm font-medium">
          <span className="font-bold text-lg">{properties.length}</span>
          <span className="text-muted-foreground ml-1">
            {properties.length === 1 ? 'propiedad' : 'propiedades'}
          </span>
        </p>
      </div>

      <BasicGoogleMap
        center={mapCenter}
        zoom={mapZoom}
        markers={mapMarkers}
        height={height}
        className="h-full w-full"
        onMarkerClick={handleMarkerClick}
        onFavoriteClick={handleFavoriteClick}
        disableAutoFit={!hasActiveFilters || !!searchCoordinates}
        hoveredMarkerId={hoveredProperty?.id || null}
        onMarkerHover={(markerId) => {
          if (markerId) {
            const property = properties.find(p => p.id === markerId);
            setHoveredProperty(property || null);
          } else {
            setHoveredProperty(null);
          }
        }}
      />
    </div>
  );
};

export default HomeMap;
