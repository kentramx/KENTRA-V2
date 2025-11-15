import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useProperty } from "@/hooks/useProperty";
import { useSimilarProperties } from "@/hooks/useSimilarProperties";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
  Star,
  User,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import propertyPlaceholder from "@/assets/property-placeholder.jpg";
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

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
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

  const extractLocation = (title: string) => {
    // Remove patterns like "Casa en Venta en " or "Departamento en Renta en "
    const patterns = [
      /^[A-Za-záéíóúñÁÉÍÓÚÑ\s]+en\s+(Venta|Renta)\s+en\s+/i,
    ];
    
    let location = title;
    for (const pattern of patterns) {
      location = location.replace(pattern, '');
    }
    
    return location.trim() || title;
  };

  if (loading) {
    return (
      <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
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
      <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
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
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto p-0">
        {/* Galería de imágenes - padding to avoid button overlap */}
        <div className="pt-12">
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
          {/* Header with Actions */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1">
              {/* Status Badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge className="bg-primary text-primary-foreground text-sm px-3 py-1">
                  {property.type}
                </Badge>
                <Badge 
                  variant={property.listing_type === 'venta' ? 'default' : 'secondary'}
                  className="text-sm px-3 py-1"
                >
                  {property.listing_type === 'venta' ? 'En Venta' : 'En Renta'}
                </Badge>
              </div>

              <h1 className="text-2xl md:text-3xl font-bold mb-3">{extractLocation(property.title)}</h1>
              
              {/* Price - Large and Prominent */}
              <div className="mb-3">
                <p className="text-3xl md:text-4xl font-bold text-foreground mb-1">
                  {formatPrice(property.price)}
                </p>
                {property.sqft && (
                  <p className="text-base text-muted-foreground">
                    {formatPrice(Math.round(property.price / property.sqft))}/m²
                  </p>
                )}
              </div>

              {/* Address */}
              <div className="flex items-center text-muted-foreground mb-4">
                <MapPin className="mr-2 h-4 w-4 flex-shrink-0" />
                <span className="text-sm md:text-base">
                  {property.address}, {property.municipality}, {property.state}
                </span>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <PropertyExportPDF property={property} agent={agent} />
              
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

              <Button
                variant={propertyId && isInCompare(propertyId) ? "default" : "outline"}
                onClick={() => {
                  if (propertyId) {
                    if (isInCompare(propertyId)) {
                      removeFromCompare(propertyId);
                    } else {
                      addToCompare(propertyId);
                    }
                  }
                }}
                size="icon"
              >
                <GitCompare className={`h-4 w-4 ${propertyId && isInCompare(propertyId) ? "fill-current" : ""}`} />
              </Button>

              <Button
                variant={isFavorite ? "default" : "outline"}
                onClick={handleToggleFavorite}
                size="icon"
              >
                <Heart
                  className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`}
                />
              </Button>
            </div>
          </div>

          {/* Agent Contact Card - Prominent Position */}
          {agent && (
            <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent mb-6">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                  
                  {/* Agent Avatar & Info */}
                  <div className="flex items-center gap-3 flex-1">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={agent.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {agent.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          to={`/agente/${agent.id}`}
                          className="font-semibold text-lg hover:text-primary transition-colors"
                        >
                          {agent.name}
                        </Link>
                        {agent.is_verified && (
                          <Badge variant="secondary" className="text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Verificado
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        {agentStats && agentStats.avgRating > 0 && (
                          <span className="flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                            {agentStats.avgRating.toFixed(1)}
                          </span>
                        )}
                        {agentStats && (
                          <span>{agentStats.totalProperties} {agentStats.totalProperties === 1 ? 'propiedad' : 'propiedades'}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Contact Buttons */}
                  <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    {user ? (
                      <>
                        {agent.whatsapp_enabled && agent.whatsapp_number && (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={handleContactWhatsApp}
                          >
                            <MessageCircle className="h-4 w-4 mr-2" />
                            WhatsApp
                          </Button>
                        )}
                        
                        {agent.phone && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(`tel:${agent.phone}`, '_self')}
                          >
                            <Phone className="h-4 w-4 mr-2" />
                            Llamar
                          </Button>
                        )}
                        
                        <ContactPropertyDialog
                          property={property}
                          agentId={agent.id}
                        />
                      </>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => navigate('/auth')}
                        className="w-full md:w-auto"
                      >
                        <User className="h-4 w-4 mr-2" />
                        Iniciar sesión para contactar
                      </Button>
                    )}
                  </div>
                </div>
                
                {user && (
                  <p className="text-xs text-muted-foreground mt-3 text-center md:text-left">
                    Tu información de contacto será compartida con el agente
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Specs - Horizontal Line (Zillow Style) */}
          <div className="flex flex-wrap items-center gap-6 pb-6 border-b border-border">
            {property.bedrooms && (
              <div className="flex items-center gap-2">
                <Bed className="h-5 w-5 text-muted-foreground" />
                <div>
                  <span className="text-2xl font-semibold">{property.bedrooms}</span>
                  <span className="text-sm text-muted-foreground ml-1">
                    {property.bedrooms === 1 ? 'recámara' : 'recámaras'}
                  </span>
                </div>
              </div>
            )}
            {property.bathrooms && (
              <div className="flex items-center gap-2">
                <Bath className="h-5 w-5 text-muted-foreground" />
                <div>
                  <span className="text-2xl font-semibold">{property.bathrooms}</span>
                  <span className="text-sm text-muted-foreground ml-1">
                    {property.bathrooms === 1 ? 'baño' : 'baños'}
                  </span>
                </div>
              </div>
            )}
            {property.parking && (
              <div className="flex items-center gap-2">
                <Car className="h-5 w-5 text-muted-foreground" />
                <div>
                  <span className="text-2xl font-semibold">{property.parking}</span>
                  <span className="text-sm text-muted-foreground ml-1">
                    estacionamiento{property.parking !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            )}
            {property.sqft && (
              <div className="flex items-center gap-2">
                <Maximize className="h-5 w-5 text-muted-foreground" />
                <div>
                  <span className="text-2xl font-semibold">{property.sqft}</span>
                  <span className="text-sm text-muted-foreground ml-1">m²</span>
                </div>
              </div>
            )}
            {property.lot_size && (
              <div className="flex items-center gap-2">
                <Ruler className="h-5 w-5 text-muted-foreground" />
                <div>
                  <span className="text-2xl font-semibold">{property.lot_size}</span>
                  <span className="text-sm text-muted-foreground ml-1">m² terreno</span>
                </div>
              </div>
            )}
          </div>

          {/* Additional Info Row */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>Publicada: {formatDate(property.created_at)}</span>
            </div>
            {property.listing_type === 'venta' && (
              <div className="flex items-center gap-1">
                <span className="font-medium">Precio de venta</span>
              </div>
            )}
          </div>

          {/* Virtual Tour */}
          <PropertyVirtualTour
            videoUrl={property.video_url}
            title={property.title}
          />

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

          {/* Investment Metrics */}
          <PropertyInvestmentMetrics
            price={property.price}
            sqft={property.sqft}
            listingType={property.listing_type}
            state={property.state}
            municipality={property.municipality}
            type={property.type}
          />

          {/* Timeline */}
          <PropertyTimeline
            createdAt={property.created_at}
            updatedAt={property.updated_at}
            priceHistory={property.price_history as any || []}
            currentPrice={property.price}
          />

          {/* Additional Details */}
          <Card>
            <CardHeader>
              <CardTitle>Detalles Adicionales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {property.lot_size && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Ruler className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Tamaño del terreno</p>
                      <p className="font-semibold">{property.lot_size} m²</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Home className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Tipo de propiedad</p>
                    <p className="font-semibold">{property.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Calendar className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Publicado</p>
                    <p className="font-semibold">{formatDate(property.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Calendar className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Actualizado</p>
                    <p className="font-semibold">{formatDate(property.updated_at)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mapa */}
          {property.lat && property.lng && (
            <Card>
              <CardHeader>
                <CardTitle>Ubicación</CardTitle>
              </CardHeader>
              <CardContent>
                <PropertyMap 
                  lat={property.lat} 
                  lng={property.lng} 
                  address={`${property.address}, ${property.municipality}, ${property.state}`}
                  height="300px"
                />
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
