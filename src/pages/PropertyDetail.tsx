import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useProperty } from "@/hooks/useProperty";
import { useSimilarProperties } from "@/hooks/useSimilarProperties";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DynamicBreadcrumbs } from "@/components/DynamicBreadcrumbs";
import { PropertyImageGallery } from "@/components/PropertyImageGallery";
// PropertyMap eliminado - Google Maps removido
import PropertyCard from "@/components/PropertyCard";
import { Skeleton } from "@/components/ui/skeleton";
import { SEOHead } from "@/components/SEOHead";
import { generatePropertyTitle, generatePropertyDescription } from "@/utils/seo";
import { generatePropertyStructuredData, generateBreadcrumbStructuredData } from "@/utils/structuredData";
import type { Property } from "@/types/property";
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
  ArrowLeft,
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
import { monitoring } from '@/lib/monitoring';
import type { AgentStats, PropertyAmenity, PropertyPriceHistory } from '@/types/property';
import { useMemo } from 'react';

// Helper para normalizar amenities
const normalizeAmenities = (amenities: Record<string, any> | null | undefined): PropertyAmenity[] => {
  if (!amenities || typeof amenities !== 'object') return [];
  
  // Si ya es un array, devolverlo
  if (Array.isArray(amenities)) {
    return amenities.filter(a => a.category && Array.isArray(a.items));
  }
  
  // Si es un objeto, convertirlo a array
  return Object.entries(amenities)
    .filter(([_, value]) => Array.isArray(value) && value.length > 0)
    .map(([category, items]) => ({
      category,
      items: items as string[],
    }));
};

// Helper para normalizar price history
const normalizePriceHistory = (priceHistory: Record<string, any> | null | undefined): PropertyPriceHistory[] => {
  if (!priceHistory) return [];
  
  if (Array.isArray(priceHistory)) {
    return priceHistory
      .filter(item => item.price && item.date)
      .map(item => {
        // Normalizar change_type para que coincida con el tipo esperado
        let changeType: 'increase' | 'reduction' | 'initial' = 'initial';
        const rawType = item.change_type || item.changeType;
        
        if (rawType === 'decrease' || rawType === 'reduction') {
          changeType = 'reduction';
        } else if (rawType === 'increase') {
          changeType = 'increase';
        }
        
        return {
          price: item.price,
          date: item.date,
          change_type: changeType,
        };
      });
  }
  
  return [];
};

const PropertyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isFavorite, setIsFavorite] = useState(false);
  const [reviewsKey, setReviewsKey] = useState(0);
  const [agentStats, setAgentStats] = useState<AgentStats | null>(null);
  const { toast } = useToast();
  const { addToCompare, isInCompare, removeFromCompare } = usePropertyCompare();
  const { trackGA4Event } = useTracking();

  // Fetch con React Query
  const { data: property, isLoading: loading, error: propertyError } = useProperty(id);
  const agent = property?.agent;
  const { data: similarProperties = [], isLoading: loadingSimilar } = useSimilarProperties(
    id,
    property?.type,
    property?.state,
    4
  );

  const handleReviewSubmitted = () => {
    setReviewsKey(prev => prev + 1);
  };

  useEffect(() => {
    if (id) {
      trackPropertyView();
      if (user) {
        checkFavorite();
      }
    }
  }, [id, user]);

  useEffect(() => {
    if (property?.agent_id) {
      fetchAgentStats(property.agent_id);
    }
  }, [property?.agent_id]);

  useEffect(() => {
    if (propertyError) {
      monitoring.error('Error loading property', {
        component: 'PropertyDetail',
        propertyId: id,
        error: propertyError,
      });
      monitoring.captureException(propertyError, {
        component: 'PropertyDetail',
        propertyId: id,
      });
      toast({
        title: "Error",
        description: "No se pudo cargar la propiedad",
        variant: "destructive",
      });
      navigate("/buscar");
    }
  }, [propertyError, id]);

  const trackPropertyView = async () => {
    try {
      await supabase.from("property_views").insert({
        property_id: id,
        viewer_id: user?.id || null,
      });

      // Track en GA4
      if (property) {
        // Si la propiedad está destacada, trackear como promoción
        const { data: featuredData } = await supabase
          .from('featured_properties')
          .select('id')
          .eq('property_id', id)
          .maybeSingle();

        if (featuredData) {
          trackGA4Event('view_promotion', {
            promotion_id: id,
            promotion_name: property.title,
            item_id: id,
            item_name: property.title,
            item_category: property.type,
            value: property.price,
            currency: 'MXN',
          });
        } else {
          trackGA4Event('view_item', {
            item_id: id,
            item_name: property.title,
            item_category: property.type,
            value: property.price,
            currency: 'MXN',
          });
        }
      }
    } catch (error) {
      // Log but don't break the page - analytics shouldn't block user experience
      monitoring.warn('Error tracking property view', {
        component: 'PropertyDetail',
        propertyId: id,
        error,
      });
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
      monitoring.error('Error checking favorite status', {
        component: 'PropertyDetail',
        propertyId: id,
        userId: user?.id,
        error,
      });
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
      monitoring.error('Error creating conversation', {
        component: 'PropertyDetail',
        propertyId: property.id,
        userId: user?.id,
        error,
      });
      monitoring.captureException(error, {
        component: 'PropertyDetail',
        action: 'create_conversation',
      });
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

        // Track en GA4
        trackGA4Event('remove_from_wishlist', {
          item_id: id,
          item_name: property?.title,
          item_category: property?.type,
          value: property?.price,
          currency: 'MXN',
        });

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

        // Track en GA4
        trackGA4Event('add_to_wishlist', {
          item_id: id,
          item_name: property?.title,
          item_category: property?.type,
          value: property?.price,
          currency: 'MXN',
        });

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
      monitoring.error('Error fetching agent stats', {
        component: 'PropertyDetail',
        agentId,
        error,
      });
    }
  };

  const handleShare = async (method: 'copy' | 'whatsapp' | 'facebook') => {
    const url = window.location.href;
    const text = `${property.title} - ${formatPrice(property.price)}`;

    try {
      switch (method) {
        case 'copy':
          await navigator.clipboard.writeText(url);
          toast({
            title: 'Enlace copiado',
            description: 'El enlace ha sido copiado al portapapeles',
          });
          break;
        case 'whatsapp': {
          // Track WhatsApp share interaction
          const { trackWhatsAppInteraction } = await import('@/utils/whatsappTracking');
          await trackWhatsAppInteraction({
            agentId: property.agent_id,
            propertyId: property.id,
            interactionType: 'share_property',
          });
          const whatsappMessage = `🏡 *${property.title}*\n\n💰 ${text}\n📍 ${property.municipality}, ${property.state}\n\n🔗 Ver más: ${url}`;
          const encoded = encodeURIComponent(whatsappMessage);
          const isMobile = /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);

          // 1) Intento con Web Share API (cuando esté disponible)
          if (navigator.share) {
            try {
              await navigator.share({
                title: property.title,
                text: whatsappMessage,
                url,
              });
              break; // Compartido exitosamente
            } catch (e) {
              // Si el usuario cancela o falla, seguimos a los fallbacks
            }
          }

          const deep = `whatsapp://send?text=${encoded}`;
          const wa = `https://wa.me/?text=${encoded}`; // evita api.whatsapp.com
          const web = `https://web.whatsapp.com/send?text=${encoded}`;

          if (isMobile) {
            // Móvil: deep link y fallback a wa.me
            window.location.href = deep;
            setTimeout(() => {
              window.location.href = wa;
            }, 600);
          } else {
            // Escritorio: intenta abrir la app y luego WhatsApp Web (sin api.whatsapp.com)
            try {
              window.location.href = deep;
            } catch {}

            setTimeout(async () => {
              try {
                window.location.assign(wa);
              } catch {
                window.location.assign(web);
              }
              // Último recurso: copiar al portapapeles
              try {
                await navigator.clipboard.writeText(whatsappMessage);
                toast({
                  title: 'Mensaje copiado',
                  description: 'Abre WhatsApp (Web o app) y pega el mensaje.',
                });
              } catch {}
            }, 700);
          }
          break;
        }
        case 'facebook':
          window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
          break;
      }
    } catch (error) {
      console.error('Error sharing:', error);
      toast({
        title: 'Error',
        description: 'No se pudo compartir',
        variant: 'destructive',
      });
    }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="aspect-video w-full rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-1/4" />
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-6 w-1/2" />
              </div>
              <div className="flex gap-6">
                <Skeleton className="h-16 w-32" />
                <Skeleton className="h-16 w-32" />
                <Skeleton className="h-16 w-32" />
              </div>
              <Skeleton className="h-40 w-full" />
            </div>
            <div className="lg:col-span-1">
              <Skeleton className="h-64 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <>
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="mb-6 text-6xl">🏠</div>
            <h1 className="text-3xl font-bold mb-2">Propiedad no encontrada</h1>
            <p className="text-muted-foreground mb-6 max-w-md">
              La propiedad que buscas no existe o ya no está disponible.
            </p>
            <Button onClick={() => navigate('/buscar')}>
              Ver propiedades disponibles
            </Button>
          </div>
        </div>
      </>
    );
  }

  // Memoizar cálculos pesados para evitar recomputación en cada render
  const propertyUrl = `${window.location.origin}/propiedad/${id}`;
  const mainImage = property.images?.[0]?.url || propertyPlaceholder;

  const seoTitle = useMemo(
    () => generatePropertyTitle({
      type: property.type,
      municipality: property.municipality,
      state: property.state,
      price: property.price,
      bedrooms: property.bedrooms || undefined,
      listingType: property.listing_type,
      colonia: property.colonia,
    }),
    [property]
  );

  const seoDescription = useMemo(
    () => generatePropertyDescription({
      type: property.type,
      municipality: property.municipality,
      state: property.state,
      price: property.price,
      bedrooms: property.bedrooms || undefined,
      bathrooms: property.bathrooms || undefined,
      sqft: property.sqft || undefined,
      parking: property.parking || undefined,
      listingType: property.listing_type,
      description: property.description || undefined,
      colonia: property.colonia,
    }),
    [property]
  );

  const structuredData = useMemo(
    () => generatePropertyStructuredData({
      property,
      url: propertyUrl,
      agentName: agent?.name,
      agentPhone: agent?.phone || undefined,
    }),
    [property, propertyUrl, agent]
  );

  const breadcrumbStructuredData = useMemo(
    () => generateBreadcrumbStructuredData([
      { name: 'Inicio', href: '/' },
      { name: 'Buscar', href: '/buscar' },
      { name: property.state, href: `/buscar?estado=${property.state}` },
      { 
        name: property.municipality, 
        href: `/buscar?estado=${property.state}&municipio=${property.municipality}` 
      },
      { name: property.title, href: `/propiedad/${id}` }
    ]),
    [property, id]
  );

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        canonical={`/propiedad/${id}`}
        ogType="product"
        ogImage={mainImage}
        ogUrl={propertyUrl}
        structuredData={[structuredData, breadcrumbStructuredData]}
      />
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

          <div className="flex gap-2">
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
              variant={isInCompare(id!) ? "default" : "outline"}
              onClick={() => {
                if (isInCompare(id!)) {
                  removeFromCompare(id!);
                } else {
                  addToCompare(id!);
                }
              }}
              size="icon"
            >
              <GitCompare className={`h-4 w-4 ${isInCompare(id!) ? "fill-current" : ""}`} />
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
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Image Gallery */}
            <PropertyImageGallery
              images={property.images || []}
              title={property.title}
              type={property.type}
              propertyId={property.id}
              price={property.price}
            />

            {/* Property Hero Section - Zillow Style */}
            <div className="mb-8 mt-6">
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
                <Badge variant="outline" className="text-sm px-3 py-1">
                  <Home className="mr-1 h-3 w-3" />
                  {property.status === 'activa' ? 'Activa' : property.status}
                </Badge>
                <Badge variant="secondary" className="font-mono text-sm px-3 py-1">
                  {(property as any).property_code || `ID: ${property.id.slice(0, 8)}`}
                </Badge>
              </div>

              {/* Price - Large and Prominent */}
              <div className="mb-4">
                <p className="text-4xl md:text-5xl font-bold text-foreground mb-2">
                  {formatPrice(property.price)}
                </p>
                {property.sqft && (
                  <p className="text-lg text-muted-foreground">
                    {formatPrice(Math.round(property.price / property.sqft))}/m²
                  </p>
                )}
              </div>

              {/* Address */}
              <div className="flex items-center text-muted-foreground mb-6">
                <MapPin className="mr-2 h-5 w-5 flex-shrink-0" />
                <span className="text-base md:text-lg">
                  {property.address}, {property.municipality}, {property.state}
                </span>
              </div>

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
              <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>Publicada: {formatDate(property.created_at)}</span>
                </div>
                {property.listing_type === 'venta' && (
                  <div className="flex items-center gap-1">
                    <span className="font-medium">
                      {property.listing_type === 'venta' ? 'Precio de venta' : 'Renta mensual'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Virtual Tour */}
            <PropertyVirtualTour
              videoUrl={property.video_url}
              title={property.title}
            />

            {/* Description */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Descripción</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-muted-foreground">
                  {property.description ||
                    "Esta propiedad no tiene descripción disponible."}
                </p>
              </CardContent>
            </Card>

            {/* Amenities */}
            <PropertyAmenities amenities={normalizeAmenities(property.amenities)} />

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
              priceHistory={normalizePriceHistory(property.price_history)}
              currentPrice={property.price}
            />

            {/* Additional Details */}
            <Card className="mb-6">
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

            {/* Ubicación - Mapa desactivado temporalmente */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Ubicación</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-5 w-5" />
                  <span>{property.address}, {property.municipality}, {property.state}</span>
                </div>
                {property.lat && property.lng && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Coordenadas: {property.lat.toFixed(6)}, {property.lng.toFixed(6)}
                  </p>
                )}
              </CardContent>
            </Card>

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

          {/* Sidebar - Agent Contact */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Contactar Agente</CardTitle>
              </CardHeader>
              <CardContent>
                {agent ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 pb-4 border-b">
                      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-2xl font-bold text-primary">
                          {agent.name?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <button
                          onClick={() => navigate(`/agente/${agent.id}`)}
                          className="font-semibold text-lg hover:text-primary transition-colors text-left"
                        >
                          {agent.name}
                        </button>
                        <div className="flex items-center gap-2 mt-1">
                          {agent.is_verified && (
                            <Badge variant="secondary" className="text-xs">
                              Verificado
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {agentStats && (
                      <div className="grid grid-cols-2 gap-3 pb-4 border-b">
                        <div className="text-center p-3 rounded-lg bg-muted/50">
                          <p className="text-2xl font-bold text-primary">{agentStats.activeProperties}</p>
                          <p className="text-xs text-muted-foreground">Propiedades</p>
                        </div>
                        {agentStats.avgRating && (
                          <div className="text-center p-3 rounded-lg bg-muted/50">
                            <p className="text-2xl font-bold text-primary">⭐ {agentStats.avgRating}</p>
                            <p className="text-xs text-muted-foreground">{agentStats.totalReviews} reseñas</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Usuarios NO autenticados */}
                    {!user && (
                      <Button 
                        className="w-full" 
                        variant="default"
                        onClick={() => navigate('/auth?redirect=' + window.location.pathname)}
                      >
                        <Mail className="mr-2 h-4 w-4" />
                        Iniciar sesión para contactar
                      </Button>
                    )}

                    {/* Usuarios autenticados: WhatsApp */}
                    {user && agent.whatsapp_enabled && agent.whatsapp_number && (
                      <Button 
                        className="w-full bg-green-600 hover:bg-green-700" 
                        onClick={async () => {
                          // Track WhatsApp contact interaction
                          const { trackWhatsAppInteraction } = await import('@/utils/whatsappTracking');
                          await trackWhatsAppInteraction({
                            agentId: agent.id,
                            propertyId: property.id,
                            interactionType: 'contact_agent',
                          });

                          const message = WhatsAppTemplates.property(
                            property.title,
                            `${property.municipality}, ${property.state}`
                          );
                          const url = getWhatsAppUrl(agent.whatsapp_number, message);
                          window.open(url, '_blank');
                        }}
                      >
                        <MessageCircle className="mr-2 h-4 w-4" />
                        WhatsApp
                      </Button>
                    )}

                    {/* Usuarios autenticados: Teléfono directo */}
                    {user && agent.phone && (
                      <Button 
                        variant="outline"
                        className="w-full"
                        onClick={() => window.open(`tel:${agent.phone}`, '_self')}
                      >
                        <Phone className="mr-2 h-4 w-4" />
                        Llamar: {agent.phone}
                      </Button>
                    )}

                    {/* Usuarios autenticados: Mensaje interno */}
                    {user && (
                      <ContactPropertyDialog
                        property={property}
                        agentId={agent.id}
                      />
                    )}

                    <Button 
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate(`/agente/${agent.id}`)}
                    >
                      Ver Perfil Completo
                    </Button>

                    <p className="text-xs text-muted-foreground text-center pt-2">
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

        {/* Similar Properties */}
        {similarProperties.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-semibold mb-6">Propiedades Similares</h2>
            {loadingSimilar ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-80 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {similarProperties.map((similar) => (
                  <PropertyCard
                    key={similar.id}
                    id={similar.id}
                    title={similar.title}
                    address={similar.address}
                    municipality={similar.municipality}
                    state={similar.state}
                    price={similar.price}
                    bedrooms={similar.bedrooms}
                    bathrooms={similar.bathrooms}
                    parking={similar.parking}
                    sqft={similar.sqft}
                    type={similar.type}
                    listingType={similar.listing_type}
                    imageUrl={similar.images?.[0]?.url || propertyPlaceholder}
                    isFavorite={false}
                    onToggleFavorite={() => {}}
                    agentId={similar.agent_id}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyDetail;
