import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useProperty } from "@/hooks/useProperty";
import { useSimilarProperties } from "@/hooks/useSimilarProperties";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PropertyImageGallery } from "@/components/PropertyImageGallery";
import { PropertyMap } from "@/components/PropertyMap";
import PropertyCard from "@/components/PropertyCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  Bed,
  Bath,
  Car,
  Maximize,
  MapPin,
  Phone,
  Mail,
  Heart,
  Share2,
  Copy,
  MessageCircle,
  Facebook,
  Calendar,
  Home,
  Ruler,
  GitCompare,
  CheckCircle2,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import propertyPlaceholder from "@/assets/property-placeholder.jpg";
import { AgentReviews } from "@/components/AgentReviews";
import { ReviewForm } from "@/components/ReviewForm";
import { PropertyAmenities } from "@/components/PropertyAmenities";
import { PropertyVirtualTour } from "@/components/PropertyVirtualTour";
import { PropertyTimeline } from "@/components/PropertyTimeline";
import { PropertyInvestmentMetrics } from "@/components/PropertyInvestmentMetrics";
import { PropertyExportPDF } from "@/components/PropertyExportPDF";
import { ContactPropertyDialog } from "@/components/ContactPropertyDialog";
import { usePropertyCompare } from "@/hooks/usePropertyCompare";
import { getWhatsAppUrl, WhatsAppTemplates } from "@/utils/whatsapp";
import { useTracking } from "@/hooks/useTracking";

interface PropertyDetailSheetProps {
  propertyId: string | null;
  open: boolean;
  onClose: () => void;
}

export function PropertyDetailSheet({ propertyId, open, onClose }: PropertyDetailSheetProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isFavorite, setIsFavorite] = useState(false);
  const [reviewsKey, setReviewsKey] = useState(0);
  const [agentStats, setAgentStats] = useState<any>(null);
  const { toast } = useToast();
  const { addToCompare, isInCompare, removeFromCompare } = usePropertyCompare();
  const { trackGA4Event } = useTracking();

  const { data: property, isLoading: loading } = useProperty(propertyId || undefined);
  const agent = property?.agent;
  const { data: similarProperties = [], isLoading: loadingSimilar } = useSimilarProperties(
    propertyId,
    property?.type,
    property?.state,
    4
  );

  const handleReviewSubmitted = () => {
    setReviewsKey(prev => prev + 1);
  };

  useEffect(() => {
    if (propertyId && open) {
      trackPropertyView();
      if (user) {
        checkFavorite();
      }
    }
  }, [propertyId, open, user]);

  useEffect(() => {
    if (property?.agent_id) {
      fetchAgentStats(property.agent_id);
    }
  }, [property?.agent_id]);

  const trackPropertyView = async () => {
    if (!propertyId) return;
    try {
      await supabase.from("property_views").insert({
        property_id: propertyId,
        viewer_id: user?.id || null,
      });

      if (property) {
        const { data: featuredData } = await supabase
          .from('featured_properties')
          .select('id')
          .eq('property_id', propertyId)
          .maybeSingle();

        if (featuredData) {
          trackGA4Event('view_promotion', {
            promotion_id: propertyId,
            promotion_name: property.title,
            item_id: propertyId,
            item_name: property.title,
            item_category: property.type,
            value: property.price,
            currency: 'MXN',
          });
        } else {
          trackGA4Event('view_item', {
            item_id: propertyId,
            item_name: property.title,
            item_category: property.type,
            value: property.price,
            currency: 'MXN',
          });
        }
      }
    } catch (error) {
      console.error("Error tracking view:", error);
    }
  };

  const checkFavorite = async () => {
    if (!user || !propertyId) return;

    try {
      const { data } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('property_id', propertyId)
        .maybeSingle();

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
        await supabase
          .from('favorites')
          .delete()
          .eq('property_id', propertyId)
          .eq('user_id', user.id);

        setIsFavorite(false);
        toast({ title: 'Removido', description: 'Propiedad removida de favoritos' });
      } else {
        await supabase
          .from('favorites')
          .insert({ property_id: propertyId, user_id: user.id });

        setIsFavorite(true);
        toast({ title: 'Agregado', description: 'Propiedad agregada a favoritos' });
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const fetchAgentStats = async (agentId: string) => {
    try {
      const { data: propertiesCount } = await supabase
        .from("properties")
        .select("id", { count: "exact" })
        .eq("agent_id", agentId)
        .eq("status", "activa");

      const { data: reviewsData } = await supabase
        .from("agent_reviews")
        .select("rating")
        .eq("agent_id", agentId);

      const avgRating = reviewsData?.length
        ? (reviewsData.reduce((acc, r) => acc + r.rating, 0) / reviewsData.length).toFixed(1)
        : null;

      setAgentStats({
        activeProperties: propertiesCount?.length || 0,
        avgRating,
        totalReviews: reviewsData?.length || 0,
      });
    } catch (error) {
      console.error("Error fetching agent stats:", error);
    }
  };

  const handleShare = async (method: 'copy' | 'whatsapp' | 'facebook') => {
    if (!property) return;
    const url = `${window.location.origin}/propiedad/${propertyId}`;
    const text = `${property.title} - ${formatPrice(property.price)}`;

    try {
      switch (method) {
        case 'copy':
          await navigator.clipboard.writeText(url);
          toast({ title: 'Enlace copiado', description: 'El enlace ha sido copiado al portapapeles' });
          break;
        case 'whatsapp':
          const whatsappMessage = `🏡 *${property.title}*\n\n💰 ${text}\n📍 ${property.municipality}, ${property.state}\n\n🔗 Ver más: ${url}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`, '_blank');
          break;
        case 'facebook':
          window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
          break;
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleContactWhatsApp = () => {
    if (!property || !agent?.whatsapp_number) return;
    const message = WhatsAppTemplates.property(property.title, `${property.municipality}, ${property.state}`);
    const url = getWhatsAppUrl(agent.whatsapp_number, message);
    window.open(url, '_blank');
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getTypeLabel = () => {
    const labels: Record<string, string> = {
      casa: "Casa",
      departamento: "Departamento",
      terreno: "Terreno",
      oficina: "Oficina",
      local: "Local Comercial",
      bodega: "Bodega",
      edificio: "Edificio",
      rancho: "Rancho",
    };
    return labels[property?.type || ""] || property?.type;
  };

  if (loading) {
    return (
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent side="right" className="w-full sm:max-w-[900px] overflow-y-auto p-0">
          <div className="p-6 space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!property) {
    return (
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent side="right" className="w-full sm:max-w-[900px]">
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-muted-foreground">No se encontró la propiedad</p>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const imageUrls = property.images?.map((img: any) => img.url) || [];

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-[900px] overflow-y-auto p-0">
        {/* Galería de imágenes */}
        <div className="relative">
          <PropertyImageGallery
            images={property.images || []}
            title={property.title}
            type={property.type}
            propertyId={property.id}
            price={property.price}
          />
        </div>

        {/* Contenido principal */}
        <div className="p-6 space-y-6">
          {/* Precio y título */}
          <div>
            <div className="flex items-start justify-between gap-4 mb-2">
              <h1 className="text-3xl font-bold text-foreground">{property.title}</h1>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleToggleFavorite}
                className="shrink-0"
              >
                <Heart className={`h-5 w-5 ${isFavorite ? "fill-red-500 text-red-500" : ""}`} />
              </Button>
            </div>
            
            <div className="flex items-center gap-2 mb-4">
              <span className="text-3xl font-bold text-primary">{formatPrice(property.price)}</span>
              <Badge variant="secondary">{getTypeLabel()}</Badge>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{property.address}, {property.municipality}, {property.state}</span>
            </div>
          </div>

          {/* Características */}
          <div className="flex flex-wrap gap-6">
            {property.bedrooms && (
              <div className="flex items-center gap-2">
                <Bed className="h-5 w-5 text-primary" />
                <span>{property.bedrooms} Recámaras</span>
              </div>
            )}
            {property.bathrooms && (
              <div className="flex items-center gap-2">
                <Bath className="h-5 w-5 text-primary" />
                <span>{property.bathrooms} Baños</span>
              </div>
            )}
            {property.parking && (
              <div className="flex items-center gap-2">
                <Car className="h-5 w-5 text-primary" />
                <span>{property.parking} Estacionamientos</span>
              </div>
            )}
            {property.sqft && (
              <div className="flex items-center gap-2">
                <Maximize className="h-5 w-5 text-primary" />
                <span>{property.sqft} m²</span>
              </div>
            )}
          </div>

          {/* Botones de acción */}
          <div className="flex flex-wrap gap-3">
            <ContactPropertyDialog property={property} agentId={property.agent_id} />

            {agent?.whatsapp_enabled && agent?.whatsapp_number && (
              <Button variant="outline" onClick={handleContactWhatsApp} className="flex-1">
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <Share2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleShare('copy')}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar enlace
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleShare('whatsapp')}>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  WhatsApp
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleShare('facebook')}>
                  <Facebook className="mr-2 h-4 w-4" />
                  Facebook
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Descripción */}
          {property.description && (
            <Card>
              <CardHeader>
                <CardTitle>Descripción</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">{property.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Amenidades */}
          {property.amenities && typeof property.amenities === 'object' && (
            <PropertyAmenities amenities={property.amenities as any} />
          )}

          {/* Mapa */}
          {property.lat && property.lng && (
            <Card>
              <CardHeader>
                <CardTitle>Ubicación</CardTitle>
              </CardHeader>
              <CardContent>
                <PropertyMap lat={property.lat} lng={property.lng} address={property.address} />
              </CardContent>
            </Card>
          )}

          {/* Información del agente */}
          {agent && (
            <Card>
              <CardHeader>
                <CardTitle>Agente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="font-semibold">{agent.name}</p>
                    {agent.phone && (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        {agent.phone}
                      </p>
                    )}
                    {agentStats && (
                      <div className="flex gap-4 mt-2 text-sm">
                        <span>{agentStats.activeProperties} propiedades</span>
                        {agentStats.avgRating && (
                          <span>⭐ {agentStats.avgRating}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <Link to={`/agente/${agent.id}`}>
                    <Button variant="outline">Ver perfil</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Propiedades similares */}
          {similarProperties.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-4">Propiedades similares</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {similarProperties.map((similarProperty: any) => (
                  <PropertyCard
                    key={similarProperty.id}
                    id={similarProperty.id}
                    title={similarProperty.title}
                    price={similarProperty.price}
                    type={similarProperty.type}
                    listingType={similarProperty.listing_type}
                    address={similarProperty.address}
                    municipality={similarProperty.municipality}
                    state={similarProperty.state}
                    bedrooms={similarProperty.bedrooms}
                    bathrooms={similarProperty.bathrooms}
                    parking={similarProperty.parking}
                    sqft={similarProperty.sqft}
                    images={similarProperty.images}
                    agentId={similarProperty.agent_id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
