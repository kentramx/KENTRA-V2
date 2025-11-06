import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import PropertyMap from "@/components/PropertyMap";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Loader2,
  Bed,
  Bath,
  Car,
  Maximize,
  MapPin,
  ArrowLeft,
  Phone,
  Mail,
  Heart,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import propertyPlaceholder from "@/assets/property-placeholder.jpg";

const PropertyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [property, setProperty] = useState<any>(null);
  const [agent, setAgent] = useState<any>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (id) {
      fetchProperty();
      if (user) {
        checkFavorite();
      }
    }
  }, [id, user]);

  const checkFavorite = async () => {
    if (!user || !id) return;

    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('property_id', id)
        .maybeSingle();

      if (error) throw error;
      setIsFavorite(!!data);
    } catch (error) {
      console.error('Error checking favorite:', error);
    }
  };

  const handleToggleFavorite = async () => {
    if (!user) {
      toast({
        title: 'Inicia sesión',
        description: 'Debes iniciar sesión para guardar favoritos',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (isFavorite) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('property_id', id)
          .eq('user_id', user.id);

        if (error) throw error;
        setIsFavorite(false);

        toast({
          title: 'Removido',
          description: 'Propiedad removida de favoritos',
        });
      } else {
        const { error } = await supabase
          .from('favorites')
          .insert({
            property_id: id,
            user_id: user.id,
          });

        if (error) throw error;
        setIsFavorite(true);

        toast({
          title: 'Agregado',
          description: 'Propiedad agregada a favoritos',
        });
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar favoritos',
        variant: 'destructive',
      });
    }
  };

  const fetchProperty = async () => {
    try {
      const { data: propertyData, error: propertyError } = await supabase
        .from("properties")
        .select(
          `
          *,
          images (
            url
          )
        `
        )
        .eq("id", id)
        .single();

      if (propertyError) throw propertyError;

      setProperty(propertyData);

      if (propertyData.agent_id) {
        const { data: agentData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", propertyData.agent_id)
          .single();

        setAgent(agentData);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo cargar la propiedad",
        variant: "destructive",
      });
      navigate("/propiedades");
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
    }).format(price);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!property) {
    return null;
  }

  const images = property.images?.length > 0
    ? property.images.map((img: any) => img.url)
    : [propertyPlaceholder];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-4 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate("/propiedades")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>

          <Button
            variant={isFavorite ? "default" : "outline"}
            onClick={handleToggleFavorite}
          >
            <Heart
              className={`mr-2 h-4 w-4 ${isFavorite ? "fill-current" : ""}`}
            />
            {isFavorite ? "Guardado" : "Guardar"}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Image Carousel */}
            <Carousel className="mb-6">
              <CarouselContent>
                {images.map((url: string, index: number) => (
                  <CarouselItem key={index}>
                    <div className="aspect-[16/9] overflow-hidden rounded-lg">
                      <img
                        src={url}
                        alt={`${property.title} - Imagen ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {images.length > 1 && (
                <>
                  <CarouselPrevious />
                  <CarouselNext />
                </>
              )}
            </Carousel>

            {/* Property Info */}
            <div className="mb-6">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <Badge className="mb-2">{property.type}</Badge>
                  <h1 className="text-3xl font-bold">{property.title}</h1>
                  <div className="mt-2 flex items-center text-muted-foreground">
                    <MapPin className="mr-1 h-4 w-4" />
                    <span>
                      {property.address}, {property.municipality},{" "}
                      {property.state}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-primary">
                    {formatPrice(property.price)}
                  </p>
                </div>
              </div>

              {/* Features */}
              <div className="mb-6 flex gap-6 border-y border-border py-4">
                {property.bedrooms && (
                  <div className="flex items-center gap-2">
                    <Bed className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{property.bedrooms}</span>
                    <span className="text-muted-foreground">Recámaras</span>
                  </div>
                )}
                {property.bathrooms && (
                  <div className="flex items-center gap-2">
                    <Bath className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{property.bathrooms}</span>
                    <span className="text-muted-foreground">Baños</span>
                  </div>
                )}
                {property.parking && (
                  <div className="flex items-center gap-2">
                    <Car className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{property.parking}</span>
                    <span className="text-muted-foreground">
                      Estacionamientos
                    </span>
                  </div>
                )}
                {property.sqft && (
                  <div className="flex items-center gap-2">
                    <Maximize className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{property.sqft} m²</span>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="mb-6">
                <h2 className="mb-3 text-2xl font-semibold">Descripción</h2>
                <p className="whitespace-pre-line text-muted-foreground">
                  {property.description ||
                    "Esta propiedad no tiene descripción disponible."}
                </p>
              </div>

              {/* Map */}
              {property.lat && property.lng && (
                <div>
                  <h2 className="mb-3 text-2xl font-semibold">Ubicación</h2>
                  <div className="h-[400px] rounded-lg overflow-hidden">
                    <PropertyMap
                      properties={[{
                        id: property.id,
                        title: property.title,
                        price: property.price,
                        lat: property.lat,
                        lng: property.lng,
                        type: property.type,
                        address: property.address,
                        municipality: property.municipality,
                        state: property.state,
                        images: property.images,
                      }]}
                      center={{ lat: property.lat, lng: property.lng }}
                      zoom={16}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Agent Contact */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Contactar Agente</CardTitle>
              </CardHeader>
              <CardContent>
                {agent ? (
                  <div className="space-y-4">
                    <div>
                      <p className="font-semibold">{agent.name}</p>
                      {agent.is_verified && (
                        <Badge variant="secondary" className="mt-1">
                          Verificado
                        </Badge>
                      )}
                    </div>

                    {agent.phone && (
                      <Button className="w-full" variant="outline">
                        <Phone className="mr-2 h-4 w-4" />
                        {agent.phone}
                      </Button>
                    )}

                    <Button className="w-full bg-secondary hover:bg-secondary/90">
                      <Mail className="mr-2 h-4 w-4" />
                      Enviar Mensaje
                    </Button>

                    <p className="text-xs text-muted-foreground">
                      Al contactar al agente, aceptas compartir tu información
                      de contacto.
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    Información del agente no disponible
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyDetail;
