import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getWhatsAppUrl, WhatsAppTemplates } from "@/utils/whatsapp";
import Navbar from "@/components/Navbar";
import PropertyCard from "@/components/PropertyCard";
import { AgentReviews } from "@/components/AgentReviews";
import { ReviewForm } from "@/components/ReviewForm";
import { ContactAgentDialog } from "@/components/ContactAgentDialog";
import AgentBadges from "@/components/AgentBadges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DynamicBreadcrumbs } from "@/components/DynamicBreadcrumbs";
import { SEOHead } from "@/components/SEOHead";
import { generateAgentTitle, generateAgentDescription } from "@/utils/seo";
import { generateAgentStructuredData } from "@/utils/structuredData";
import {
  ArrowLeft,
  Home,
  Star,
  TrendingUp,
  Phone,
  Mail,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Smartphone,
} from "lucide-react";

interface BadgeData {
  code: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  priority: number;
  is_secret?: boolean;
}

interface AgentStats {
  totalProperties: number;
  activeProperties: number;
  soldProperties: number;
  averageRating: number;
  totalReviews: number;
}

const AgentProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [agent, setAgent] = useState<any>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [badges, setBadges] = useState<BadgeData[]>([]);
  const [stats, setStats] = useState<AgentStats>({
    totalProperties: 0,
    activeProperties: 0,
    soldProperties: 0,
    averageRating: 0,
    totalReviews: 0,
  });
  const [loading, setLoading] = useState(true);
  const [reviewsKey, setReviewsKey] = useState(0);

  useEffect(() => {
    if (id) {
      fetchAgentData();
    }
  }, [id]);

  const fetchAgentData = async () => {
    try {
      // Fetch agent profile
      const { data: agentData, error: agentError } = await supabase
        .from("profiles")
        .select("*, is_verified, phone_verified, whatsapp_verified, avatar_url, bio, city, state")
        .eq("id", id)
        .single();

      if (agentError) throw agentError;
      setAgent(agentData);

      // Fetch agent badges
      const { data: badgesData, error: badgesError } = await supabase
        .from("user_badges")
        .select("badge_code, badge_definitions(code, name, description, icon, color, priority, is_secret)")
        .eq("user_id", id);

      if (!badgesError && badgesData) {
        const fetchedBadges = badgesData.map((ub: any) => ub.badge_definitions).filter(Boolean);
        setBadges(fetchedBadges);
      }

      // Auto-assign badges based on current stats
      await supabase.rpc("auto_assign_badges", { p_user_id: id });

      // Fetch agent properties
      const { data: propertiesData, error: propertiesError } = await supabase
        .from("properties")
        .select(`
          *,
          images (url)
        `)
        .eq("agent_id", id)
        .order("created_at", { ascending: false });

      if (propertiesError) throw propertiesError;
      setProperties(propertiesData || []);

      // Fetch reviews statistics
      const { data: reviewsData, error: reviewsError } = await supabase
        .from("agent_reviews")
        .select("rating")
        .eq("agent_id", id);

      if (reviewsError) throw reviewsError;

      // Calculate statistics
      const activeCount = propertiesData?.filter(p => p.status === 'activa').length || 0;
      const soldCount = propertiesData?.filter(p => p.status === 'vendida').length || 0;
      const reviewCount = reviewsData?.length || 0;
      const avgRating = reviewCount > 0 
        ? reviewsData.reduce((sum, r) => sum + r.rating, 0) / reviewCount 
        : 0;

      setStats({
        totalProperties: propertiesData?.length || 0,
        activeProperties: activeCount,
        soldProperties: soldCount,
        averageRating: avgRating,
        totalReviews: reviewCount,
      });
    } catch (error) {
      console.error("Error fetching agent data:", error);
      navigate("/buscar");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!agent) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumbs */}
        <DynamicBreadcrumbs 
          items={[
            { label: 'Inicio', href: '/', active: false },
            { label: agent.name, href: '', active: true }
          ]} 
          className="mb-4" 
        />

        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>

        {/* Agent Header */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <Avatar className="h-24 w-24 border-2 border-border">
                <AvatarImage src={agent.avatar_url} alt={agent.name} />
                <AvatarFallback className="text-3xl bg-primary/10 text-primary">
                  {agent.name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <div className="mb-2">
                  <h1 className="text-3xl font-bold mb-2">{agent.name}</h1>
                  
                  {/* Ubicación */}
                  {(agent.city || agent.state) && (
                    <p className="text-muted-foreground mb-3 flex items-center gap-1">
                      <span>📍</span>
                      {[agent.city, agent.state].filter(Boolean).join(", ")}
                    </p>
                  )}
                  
                  {/* Biografía */}
                  {agent.bio && (
                    <p className="text-muted-foreground mb-4 leading-relaxed">
                      {agent.bio}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    {agent.is_verified && (
                      <Badge variant="outline" className="flex items-center gap-1.5 bg-purple-50 text-purple-700 border-purple-200 px-3 py-1">
                        <CheckCircle2 className="h-4 w-4" />
                        Identidad Verificada
                      </Badge>
                    )}
                    {agent.phone_verified && (
                      <Badge variant="outline" className="flex items-center gap-1 bg-blue-50 text-blue-700 border-blue-200">
                        <Smartphone className="h-3 w-3" />
                        Teléfono Verificado
                      </Badge>
                    )}
                    {agent.whatsapp_verified && (
                      <Badge variant="outline" className="flex items-center gap-1 bg-green-50 text-green-700 border-green-200">
                        <MessageCircle className="h-3 w-3" />
                        WhatsApp Verificado
                      </Badge>
                    )}
                  </div>
                </div>
                
                {badges && badges.length > 0 && (
                  <div className="mb-4">
                    <AgentBadges badges={badges} maxVisible={5} size="md" />
                  </div>
                )}

                {stats.totalReviews > 0 && (
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          className={`w-5 h-5 ${
                            i < Math.round(stats.averageRating)
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="font-semibold">{stats.averageRating.toFixed(1)}</span>
                    <span className="text-muted-foreground">
                      ({stats.totalReviews} {stats.totalReviews === 1 ? "reseña" : "reseñas"})
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  {/* Usuarios NO autenticados */}
                  {!user && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => navigate('/auth?redirect=' + window.location.pathname)}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Iniciar sesión para contactar
                    </Button>
                  )}

                  {/* Usuarios autenticados: WhatsApp */}
                  {user && agent.whatsapp_number && agent.whatsapp_enabled && (
                    <Button 
                      variant="default" 
                      size="sm"
                      onClick={() => {
                        const whatsappUrl = getWhatsAppUrl(
                          agent.whatsapp_number,
                          WhatsAppTemplates.agent(agent.name)
                        );
                        window.open(whatsappUrl, '_blank');
                      }}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <MessageCircle className="mr-2 h-4 w-4" />
                      WhatsApp
                    </Button>
                  )}

                  {/* Usuarios autenticados: Teléfono directo */}
                  {user && agent.phone && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open(`tel:${agent.phone}`, '_self')}
                    >
                      <Phone className="mr-2 h-4 w-4" />
                      Llamar: {agent.phone}
                    </Button>
                  )}

                  {/* Usuarios autenticados: Mensaje interno */}
                  {user && (
                    <ContactAgentDialog 
                      agentId={agent.id} 
                      agentName={agent.name} 
                    />
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Propiedades Totales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Home className="h-5 w-5 text-primary" />
                <span className="text-3xl font-bold">{stats.totalProperties}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Propiedades Activas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <span className="text-3xl font-bold">{stats.activeProperties}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Propiedades Vendidas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-blue-500" />
                <span className="text-3xl font-bold">{stats.soldProperties}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Calificación Promedio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                <span className="text-3xl font-bold">
                  {stats.totalReviews > 0 ? stats.averageRating.toFixed(1) : "N/A"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Properties Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Propiedades Publicadas ({properties.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {properties.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {properties.map((property) => (
                  <PropertyCard 
                    key={property.id} 
                    id={property.id}
                    title={property.title}
                    price={property.price}
                    type={property.type}
                    listingType={property.listing_type}
                    address={property.address}
                    municipality={property.municipality}
                    state={property.state}
                    bedrooms={property.bedrooms}
                    bathrooms={property.bathrooms}
                    parking={property.parking}
                    sqft={property.sqft}
                    imageUrl={property.images?.[0]?.url}
                    agentId={property.agent_id}
                  />
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Este agente no tiene propiedades publicadas
              </p>
            )}
          </CardContent>
        </Card>

        {/* Reviews Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Reseñas de Clientes</CardTitle>
              {user && user.id !== id && (
                <ReviewForm 
                  agentId={id!} 
                  onReviewSubmitted={() => setReviewsKey(prev => prev + 1)}
                />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <AgentReviews key={reviewsKey} agentId={id!} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AgentProfile;