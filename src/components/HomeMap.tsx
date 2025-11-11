import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const { data, error } = await supabase
          .from("properties")
          .select(
            `
            id, title, price, bedrooms, bathrooms, 
            lat, lng, address, state, municipality, type, listing_type,
            images (url, position)
          `
          )
          .eq("status", "activa")
          .order("position", { foreignTable: "images", ascending: true })
          .limit(1000);

        if (error) throw error;

        const normalized = (data || []).map((p: any) => ({
          ...p,
          type: p.type === "local_comercial" ? "local" : p.type,
          images: (p.images || []).sort((a: any, b: any) => a.position - b.position),
        })) as Property[];

        setProperties(normalized);
      } catch (e) {
        console.error("Error fetching properties for HomeMap:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, []);

  const markers = useMemo(
    () =>
      properties
        .filter((p) => p.lat && p.lng)
        .map((p) => ({
          id: p.id,
          lat: p.lat as number,
          lng: p.lng as number,
          title: p.title,
          price: p.price,
          bedrooms: p.bedrooms || undefined,
          bathrooms: p.bathrooms || undefined,
          images: p.images,
          listing_type: p.listing_type,
          address: `${p.address}, ${p.municipality}, ${p.state}`,
        })),
    [properties]
  );

  const firstWithCoords = useMemo(() => markers[0], [markers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-muted/20" style={{ height }}>
        <p className="text-muted-foreground">Cargando mapa…</p>
      </div>
    );
  }

  if (markers.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-muted/20" style={{ height }}>
        <p className="text-muted-foreground">No hay propiedades para mostrar en el mapa</p>
      </div>
    );
  }

  return (
    <BasicGoogleMap
      center={firstWithCoords ? { lat: firstWithCoords.lat, lng: firstWithCoords.lng } : { lat: 23.6345, lng: -102.5528 }}
      zoom={6}
      height={height}
      markers={markers}
      enableClustering={true}
      onMarkerClick={(id) => navigate(`/propiedad/${id}`)}
      disableAutoFit={false}
    />
  );
};

export default HomeMap;
