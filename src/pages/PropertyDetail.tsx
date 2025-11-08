import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DynamicBreadcrumbs } from "@/components/DynamicBreadcrumbs";
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
import { toast as sonnerToast } from "sonner";
import propertyPlaceholder from "@/assets/property-placeholder.jpg";
import { AgentReviews } from "@/components/AgentReviews";
import { ReviewForm } from "@/components/ReviewForm";

const PropertyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [property, setProperty] = useState<any>(null);
  const [agent, setAgent] = useState<any>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewsKey, setReviewsKey] = useState(0);
  const { toast } = useToast();

  const handleReviewSubmitted = () => {
    setReviewsKey(prev => prev + 1);
  };

  useEffect(() => {
    if (id) {
      fetchProperty();
      trackPropertyView();
      if (user) {
        checkFavorite();
      }
    }
  }, [id, user]);

  const trackPropertyView = async () => {
    try {
      await supabase.from("property_views").insert({
        property_id: id,
        viewer_id: user?.id || null,
      });
    } catch (error) {
      // Silently fail - analytics shouldn't break the page
      console.error("Error tracking view:", error);
    }
  };

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

  const handleSendMessage = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!property) return;

    try {
      // Verificar si ya existe una conversación
      const { data: existingConvo } = await supabase
        .from('conversations')
        .select('id')
        .eq('property_id', property.id)
        .eq('buyer_id', user.id)
        .eq('agent_id', property.agent_id)
        .single();

      if (existingConvo) {
        // Ya existe, navegar a ella
        navigate(`/mensajes?conversation=${existingConvo.id}`);
      } else {
        // Crear nueva conversación
        const { data: newConvo, error } = await supabase
          .from('conversations')
          .insert({
            property_id: property.id,
            buyer_id: user.id,
            agent_id: property.agent_id,
          })
          .select()
          .single();

        if (error) throw error;

        // Navegar a la nueva conversación
        navigate(`/mensajes?conversation=${newConvo.id}&new=true`);
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      sonnerToast.error('Error al iniciar la conversación');
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
      navigate("/buscar");
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
        {/* Breadcrumbs */}
        <DynamicBreadcrumbs 
          items={[
            { label: 'Inicio', href: '/', active: false },
            { label: 'Buscar', href: '/buscar', active: false },
            { label: property.state, href: `/buscar?estado=${property.state}`, active: false },
            { 
              label: property.municipality, 
              href: `/buscar?estado=${property.state}&municipio=${property.municipality}`, 
              active: false 
            },
            { label: property.title, href: '', active: true }
          ]} 
          className="mb-4" 
        />

        <div className="mb-4 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate("/buscar")}
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

              {/* Agent Reviews */}
              {agent && (
                <div className="mb-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-2xl font-semibold">Reseñas del Agente</h2>
                    <ReviewForm 
                      agentId={agent.id} 
                      propertyId={property.id}
                      onReviewSubmitted={handleReviewSubmitted}
                    />
                  </div>
                  <AgentReviews key={reviewsKey} agentId={agent.id} />
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
                      <button
                        onClick={() => navigate(`/agente/${agent.id}`)}
                        className="font-semibold hover:text-primary transition-colors text-left"
                      >
                        {agent.name}
                      </button>
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

                    <Button 
                      className="w-full bg-secondary hover:bg-secondary/90"
                      onClick={handleSendMessage}
                    >
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
