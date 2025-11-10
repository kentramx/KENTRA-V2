import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import PropertyCard from "@/components/PropertyCard";
import { AgentReviews } from "@/components/AgentReviews";
import AgentBadges from "@/components/AgentBadges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DynamicBreadcrumbs } from "@/components/DynamicBreadcrumbs";
import {
  ArrowLeft,
  Home,
  Star,
  TrendingUp,
  Phone,
  Mail,
  CheckCircle2,
  Loader2,
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
        .select("*")
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
              <Avatar className="h-24 w-24">
                <AvatarFallback className="text-3xl">
                  {agent.name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold">{agent.name}</h1>
                  {agent.is_verified && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Verificado
                    </Badge>
                  )}
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
                  {agent.phone && (
                    <Button variant="outline" size="sm">
                      <Phone className="mr-2 h-4 w-4" />
                      {agent.phone}
                    </Button>
                  )}
                  <Button variant="outline" size="sm">
                    <Mail className="mr-2 h-4 w-4" />
                    Contactar
                  </Button>
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
            <CardTitle>Reseñas de Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <AgentReviews agentId={id!} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AgentProfile;