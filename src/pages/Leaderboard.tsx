import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { DynamicBreadcrumbs } from "@/components/DynamicBreadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import AgentBadges from "@/components/AgentBadges";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Star, TrendingUp, Medal, Crown } from "lucide-react";
import { Link } from "react-router-dom";
import { mexicoStates } from "@/data/mexicoLocations";

interface BadgeData {
  code: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  priority: number;
  is_secret?: boolean;
}

interface LeaderboardAgent {
  id: string;
  name: string;
  type: 'agent' | 'agency';
  avatar_url?: string;
  sold_properties: number;
  avg_rating: number;
  total_reviews: number;
  active_properties: number;
  state: string;
  city: string;
  badges: BadgeData[];
  badge_score: number;
  is_verified: boolean;
}

const Leaderboard = () => {
  const [agents, setAgents] = useState<LeaderboardAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedState, setSelectedState] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"sellers" | "rated" | "badges">("sellers");

  useEffect(() => {
    fetchLeaderboard();
  }, [selectedState]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      // Fetch agents with their stats
      const { data: agentsData, error: agentsError } = await supabase
        .from("profiles")
        .select(`
          id,
          name,
          is_verified,
          user_roles!inner(role),
          properties(id, status, state, municipality),
          agent_reviews:agent_reviews!agent_id(rating),
          user_badges(
            badge_code,
            badge_definitions(code, name, description, icon, color, priority, is_secret)
          )
        `)
        .eq("user_roles.role", "agent");

      if (agentsError) throw agentsError;

      const processedAgents: LeaderboardAgent[] = (agentsData || []).map((profile: any) => {
        const properties = profile.properties || [];
        const activeProperties = properties.filter((p: any) => p.status === 'activa');
        const soldProperties = properties.filter((p: any) => p.status === 'vendida');
        const reviews = profile.agent_reviews || [];
        const avgRating = reviews.length > 0
          ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
          : 0;

        // Get most frequent state/city
        const states = properties.map((p: any) => p.state).filter(Boolean);
        const municipalities = properties.map((p: any) => p.municipality).filter(Boolean);
        const mostFrequentState = states.length > 0 ? states.sort((a: string, b: string) =>
          states.filter((s: string) => s === a).length - states.filter((s: string) => s === b).length
        ).pop() : "";
        const mostFrequentCity = municipalities.length > 0 ? municipalities.sort((a: string, b: string) =>
          municipalities.filter((m: string) => m === a).length - municipalities.filter((m: string) => m === b).length
        ).pop() : "";

        const badges = profile.user_badges?.map((ub: any) => ub.badge_definitions).filter(Boolean) || [];
        const badgeScore = badges.reduce((sum: number, badge: BadgeData) => sum + badge.priority, 0);

        return {
          id: profile.id,
          name: profile.name,
          type: 'agent',
          sold_properties: soldProperties.length,
          avg_rating: avgRating,
          total_reviews: reviews.length,
          active_properties: activeProperties.length,
          state: mostFrequentState,
          city: mostFrequentCity,
          badges,
          badge_score: badgeScore,
          is_verified: profile.is_verified || false,
        };
      });

      // Filter by state if selected
      let filteredAgents = processedAgents;
      if (selectedState !== "all") {
        filteredAgents = processedAgents.filter(a => a.state === selectedState);
      }

      setAgents(filteredAgents);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Crown className="h-6 w-6 text-yellow-500" />;
    if (index === 1) return <Medal className="h-6 w-6 text-gray-400" />;
    if (index === 2) return <Medal className="h-6 w-6 text-amber-700" />;
    return <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>;
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return "from-yellow-500 to-orange-500";
    if (index === 1) return "from-gray-400 to-gray-500";
    if (index === 2) return "from-amber-700 to-yellow-800";
    return "from-secondary to-secondary";
  };

  const sortedBySales = [...agents].sort((a, b) => b.sold_properties - a.sold_properties);
  const sortedByRating = [...agents].filter(a => a.total_reviews >= 5).sort((a, b) => b.avg_rating - a.avg_rating);
  const sortedByBadges = [...agents].sort((a, b) => b.badge_score - a.badge_score);

  const renderAgentCard = (agent: LeaderboardAgent, index: number) => (
    <Card key={agent.id} className="group hover:shadow-lg transition-all">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 flex items-center justify-center">
              {getRankIcon(index)}
            </div>
            {index < 3 && (
              <Badge className={`bg-gradient-to-r ${getRankBadge(index)} text-white border-0`}>
                Top {index + 1}
              </Badge>
            )}
          </div>

          <Avatar className="h-16 w-16 border-2 border-border">
            <AvatarFallback className="text-xl font-semibold bg-primary/10 text-primary">
              {agent.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <Link to={`/agente/${agent.id}`} className="group/name">
              <h3 className="font-semibold text-lg leading-tight truncate group-hover/name:text-primary transition-colors">
                {agent.name}
              </h3>
            </Link>
            
            {agent.badges && agent.badges.length > 0 && (
              <div className="mt-2">
                <AgentBadges badges={agent.badges} maxVisible={3} size="sm" />
              </div>
            )}

            <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  <span className="font-bold text-2xl">{agent.sold_properties}</span>
                </div>
                <p className="text-muted-foreground text-xs">Vendidas</p>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  <span className="font-bold text-2xl">{agent.avg_rating.toFixed(1)}</span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {agent.total_reviews} reviews
                </p>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="font-bold text-2xl">{agent.active_properties}</span>
                </div>
                <p className="text-muted-foreground text-xs">Activas</p>
              </div>
            </div>

            {(agent.city || agent.state) && (
              <p className="text-sm text-muted-foreground mt-3">
                📍 {agent.city && agent.state ? `${agent.city}, ${agent.state}` : agent.city || agent.state}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-6 md:py-8 pb-24 md:pb-8">
        <DynamicBreadcrumbs 
          items={[
            { label: 'Inicio', href: '/', active: false },
            { label: 'Leaderboard', href: '', active: true }
          ]} 
          className="mb-4" 
        />

        {/* Header */}
        <div className="text-center mb-6 md:mb-8">
          <div className="flex items-center justify-center gap-2 md:gap-3 mb-3 md:mb-4">
            <Trophy className="h-8 w-8 md:h-12 md:w-12 text-yellow-500" />
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">Leaderboard de Agentes</h1>
          </div>
          <p className="text-muted-foreground text-base md:text-lg">
            Los mejores agentes inmobiliarios de México
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-6 md:mb-8">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 items-stretch sm:items-center">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">
                  Filtrar por Estado
                </label>
                <Select value={selectedState} onValueChange={setSelectedState}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    {mexicoStates.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="sellers" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Top Vendedores
            </TabsTrigger>
            <TabsTrigger value="rated" className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              Mejor Calificados
            </TabsTrigger>
            <TabsTrigger value="badges" className="flex items-center gap-2">
              <Medal className="h-4 w-4" />
              Más Badges
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sellers" className="space-y-4">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="flex gap-4">
                      <Skeleton className="h-16 w-16 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-6 w-1/3" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : sortedBySales.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Trophy className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No hay datos disponibles</h3>
                  <p className="text-muted-foreground">
                    {selectedState !== "all" 
                      ? "No hay agentes en este estado aún"
                      : "No hay agentes registrados"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              sortedBySales.slice(0, 50).map((agent, index) => renderAgentCard(agent, index))
            )}
          </TabsContent>

          <TabsContent value="rated" className="space-y-4">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="flex gap-4">
                      <Skeleton className="h-16 w-16 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-6 w-1/3" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : sortedByRating.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Star className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No hay datos disponibles</h3>
                  <p className="text-muted-foreground">
                    No hay agentes con al menos 5 reviews en este estado
                  </p>
                </CardContent>
              </Card>
            ) : (
              sortedByRating.slice(0, 50).map((agent, index) => renderAgentCard(agent, index))
            )}
          </TabsContent>

          <TabsContent value="badges" className="space-y-4">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="flex gap-4">
                      <Skeleton className="h-16 w-16 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-6 w-1/3" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : sortedByBadges.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Medal className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No hay datos disponibles</h3>
                  <p className="text-muted-foreground">
                    No hay agentes con badges en este estado
                  </p>
                </CardContent>
              </Card>
            ) : (
              sortedByBadges.filter(a => a.badges.length > 0).slice(0, 50).map((agent, index) => renderAgentCard(agent, index))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Leaderboard;
