import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AgentCard from "@/components/AgentCard";
import AgentSearchBar from "@/components/AgentSearchBar";
import Navbar from "@/components/Navbar";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface BadgeData {
  code: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  priority: number;
  is_secret?: boolean;
}

interface AgentData {
  id: string;
  name: string;
  type: 'agent' | 'agency';
  role: string;
  city: string;
  state: string;
  active_properties: number;
  avg_rating: number | null;
  total_reviews: number;
  is_verified: boolean;
  phone_verified?: boolean;
  whatsapp_verified?: boolean;
  logo_url?: string;
  plan_name: string | null;
  plan_level: string | null;
  badges: BadgeData[];
}

const DirectorioAgentes = () => {
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    state: "",
    municipality: "",
    type: "all",
    minRating: 0,
    minProperties: 0,
    plan: "all",
  });
  const [sortBy, setSortBy] = useState<"active" | "rating" | "recent">("active");
  const [page, setPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchAgents();
  }, [filters, sortBy]);

  const fetchAgents = async () => {
    setLoading(true);
    setError(null);

    try {
      // Primero obtener los IDs de usuarios con rol 'agent'
      const { data: agentRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "agent");

      let agentIds = agentRoles?.map(r => r.user_id) || [];

      // Fallback: si RLS impide leer user_roles o no hay resultados, tomar agentes desde properties activas
      if (agentIds.length === 0) {
        const { data: propAgents } = await supabase
          .from("properties")
          .select("agent_id")
          .eq("status", "activa");
        const fromProps = Array.from(new Set((propAgents || []).map((p: any) => p.agent_id))).filter(Boolean);
        agentIds = fromProps;
      }

      // Fetch individual agents usando los IDs obtenidos (aplicar .in solo si hay IDs)
      let agentsQuery = supabase
        .from("profiles")
        .select(`
          id,
          name,
          avatar_url,
          is_verified,
          phone_verified,
          whatsapp_verified,
          properties(id, status, state, municipality),
          agent_reviews:agent_reviews!agent_id(rating)
        `);
      if (agentIds.length > 0) {
        agentsQuery = agentsQuery.in("id", agentIds);
      }

      // Fetch agencies
      let agenciesQuery = supabase
        .from("agencies")
        .select(`
          id,
          name,
          state,
          city,
          is_verified,
          logo_url,
          owner_id
        `);

      const [agentsResult, agenciesResult] = await Promise.all([
        agentsQuery,
        agenciesQuery,
      ]);

      if (agentsResult.error) throw agentsResult.error;
      if (agenciesResult.error) throw agenciesResult.error;

      // Obtener suscripciones de los agentes (condicional si hay IDs)
      let agentSubscriptions: any[] = [];
      if (agentIds.length > 0) {
        const { data } = await supabase
          .from("user_subscriptions")
          .select("user_id, status, subscription_plans(display_name, name)")
          .in("user_id", agentIds)
          .eq("status", "active");
        agentSubscriptions = data || [];
      }

      const subscriptionMap = new Map(
        (agentSubscriptions || []).map((sub: any) => [sub.user_id, sub])
      );

      // Obtener badges de los agentes en una sola consulta (condicional si hay IDs)
      let agentBadgesRows: any[] = [];
      if (agentIds.length > 0) {
        const { data } = await supabase
          .from("user_badges")
          .select("user_id, badge_definitions(code, name, description, icon, color, priority, is_secret)")
          .in("user_id", agentIds);
        agentBadgesRows = data || [];
      }

      const badgesMap = new Map<string, BadgeData[]>();
      (agentBadgesRows || []).forEach((row: any) => {
        const list = badgesMap.get(row.user_id) || [];
        if (row.badge_definitions) list.push(row.badge_definitions);
        badgesMap.set(row.user_id, list);
      });

      // Process agents
      const processedAgents: AgentData[] = (agentsResult.data || []).map((profile: any) => {
        const activeProperties = profile.properties?.filter((p: any) => p.status === 'activa') || [];
        const reviews = profile.agent_reviews || [];
        const avgRating = reviews.length > 0
          ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
          : null;

        // Get most frequent state/city from properties
        const states = activeProperties.map((p: any) => p.state);
        const municipalities = activeProperties.map((p: any) => p.municipality);
        const mostFrequentState = states.length > 0 ? states.sort((a: string, b: string) =>
          states.filter((s: string) => s === a).length - states.filter((s: string) => s === b).length
        ).pop() : "";
        const mostFrequentCity = municipalities.length > 0 ? municipalities.sort((a: string, b: string) =>
          municipalities.filter((m: string) => m === a).length - municipalities.filter((m: string) => m === b).length
        ).pop() : "";

        const subscription = subscriptionMap.get(profile.id);
        const badges = badgesMap.get(profile.id) || [];
        
        return {
          id: profile.id,
          name: profile.name,
          type: 'agent',
          role: 'agent',
          city: mostFrequentCity,
          state: mostFrequentState,
          active_properties: activeProperties.length,
          avg_rating: avgRating,
          total_reviews: reviews.length,
          is_verified: profile.is_verified || false,
          phone_verified: profile.phone_verified || false,
          whatsapp_verified: profile.whatsapp_verified || false,
          avatar_url: profile.avatar_url,
          plan_name: subscription?.subscription_plans?.display_name || "Sin Plan",
          plan_level: subscription?.subscription_plans?.name || null,
          badges,
        };
      });

      // Obtener owner_ids de las agencias
      const ownerIds = agenciesResult.data?.map(a => a.owner_id) || [];

      // Obtener suscripciones de los owners de las agencias
      const { data: agencySubscriptions } = await supabase
        .from("user_subscriptions")
        .select("user_id, status, subscription_plans(display_name, name)")
        .in("user_id", ownerIds)
        .eq("status", "active");

      const agencySubscriptionMap = new Map(
        agencySubscriptions?.map(sub => [sub.user_id, sub]) || []
      );

      // Process agencies
      const processedAgencies: AgentData[] = await Promise.all(
        (agenciesResult.data || []).map(async (agency: any) => {
          // Fetch properties for this agency directly by agency_id
          const { data: properties } = await supabase
            .from("properties")
            .select("id, status, agent_id")
            .eq("agency_id", agency.id)
            .eq("status", "activa");

          // Derive unique agent ids from properties to fetch reviews
          const agentIdsForReviews = Array.from(new Set((properties || []).map((p: any) => p.agent_id))).filter(Boolean);

          let reviews: any[] = [];
          if (agentIdsForReviews.length > 0) {
            const { data: reviewsData } = await supabase
              .from("agent_reviews")
              .select("rating")
              .in("agent_id", agentIdsForReviews);
            reviews = reviewsData || [];
          }

          const activeProperties = properties?.length || 0;
          const avgRating = reviews && reviews.length > 0
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
            : null;

          const subscription = agencySubscriptionMap.get(agency.owner_id);

          // Fetch badges for agency owner
          const { data: ownerBadges } = await supabase
            .from("user_badges")
            .select("badge_code, badge_definitions(code, name, description, icon, color, priority, is_secret)")
            .eq("user_id", agency.owner_id);

          const badges = ownerBadges?.map((ub: any) => ub.badge_definitions).filter(Boolean) || [];

          return {
            id: agency.id,
            name: agency.name,
            type: 'agency',
            role: 'agency',
            city: agency.city || "",
            state: agency.state || "",
            active_properties: activeProperties,
            avg_rating: avgRating,
            total_reviews: reviews?.length || 0,
            is_verified: agency.is_verified || false,
            logo_url: agency.logo_url,
            plan_name: subscription?.subscription_plans?.display_name || "Sin Plan",
            plan_level: subscription?.subscription_plans?.name || null,
            badges,
          };
        })
      );

      let combinedData = [...processedAgents, ...processedAgencies];

      // Apply filters
      if (filters.state) {
        combinedData = combinedData.filter((a) => a.state === filters.state);
      }
      if (filters.municipality) {
        combinedData = combinedData.filter((a) => a.city === filters.municipality);
      }
      if (filters.type !== "all") {
        combinedData = combinedData.filter((a) => a.type === filters.type);
      }
      if (filters.minRating > 0) {
        combinedData = combinedData.filter((a) => a.avg_rating && a.avg_rating >= filters.minRating);
      }
      if (filters.minProperties > 0) {
        combinedData = combinedData.filter((a) => a.active_properties >= filters.minProperties);
      }
      if (filters.plan !== "all") {
        combinedData = combinedData.filter((a) => {
          if (filters.plan === "pro_elite") {
            return a.plan_level === "pro" || a.plan_level === "elite";
          }
          return true;
        });
      }

      // Función para determinar el nivel del plan
      const getPlanLevel = (planLevel: string | null) => {
        if (!planLevel) return 0;
        if (planLevel.includes('elite')) return 3;
        if (planLevel.includes('pro') || planLevel.includes('grow')) return 2;
        if (planLevel.includes('basico') || planLevel.includes('start')) return 1;
        return 0;
      };

      // Función para calcular score de badges de logros (excluye badges de plan)
      const getAchievementBadgeScore = (badges: BadgeData[]) => {
        if (!badges || badges.length === 0) return 0;
        
        // Filtrar solo badges de logros (no de plan)
        const achievementBadges = badges.filter(badge => 
          !badge.code.includes('plan_') && !badge.code.includes('agency_')
        );
        
        // Sumar priority de badges de logros: top_seller (100), five_stars (95), active_seller (70)
        // Máximo teórico = 265 puntos, normalizar a escala de 15
        const totalPriority = achievementBadges.reduce((sum, badge) => sum + badge.priority, 0);
        return Math.min(15, (totalPriority / 265) * 15);
      };

      // Sistema de scoring compuesto con pesos ajustados para 7 badges
      const calculateAgentScore = (agent: AgentData): number => {
        let score = 0;
        
        // 1. Plan Level (30%) - Mayor compromiso y seriedad
        const planScore = getPlanLevel(agent.plan_level);
        score += planScore === 3 ? 30 : planScore === 2 ? 25 : planScore === 1 ? 15 : 0;
        
        // 2. Rating (25%) - Calidad del servicio verificada
        if (agent.avg_rating) {
          if (agent.avg_rating >= 5) score += 25;
          else if (agent.avg_rating >= 4.5) score += 22;
          else if (agent.avg_rating >= 4) score += 18;
          else if (agent.avg_rating >= 3) score += 10;
          else score += 5;
        }
        
        // 3. Badges de Logros (15%) - Reconocimientos ganados (excluye badges de plan)
        score += getAchievementBadgeScore(agent.badges);
        
        // 4. Active Properties (15%) - Inventario y actividad
        if (agent.active_properties >= 20) score += 15;
        else if (agent.active_properties >= 10) score += 12;
        else if (agent.active_properties >= 5) score += 8;
        else if (agent.active_properties >= 1) score += 4;
        
        // 5. Total Reviews (10%) - Experiencia y confianza
        if (agent.total_reviews >= 20) score += 10;
        else if (agent.total_reviews >= 10) score += 8;
        else if (agent.total_reviews >= 5) score += 5;
        else if (agent.total_reviews >= 1) score += 2;
        
        // 6. Bonus: KYC verificado (+3 puntos) - Identidad confirmada
        if (agent.is_verified) {
          score += 3;
        }
        
        // 7. Bonus: WhatsApp verificado (+2 puntos) - Contacto rápido
        if (agent.whatsapp_verified) {
          score += 2;
        }
        
        return score;
      };

      // Apply sorting basado en score compuesto
      combinedData.sort((a, b) => {
        const scoreA = calculateAgentScore(a);
        const scoreB = calculateAgentScore(b);
        
        // Primary sort: Total score
        if (scoreA !== scoreB) return scoreB - scoreA;
        
        // Tiebreaker: Secondary sort preference
        if (sortBy === "active") {
          return b.active_properties - a.active_properties;
        }
        if (sortBy === "rating") {
          return (b.avg_rating || 0) - (a.avg_rating || 0);
        }
        
        return 0;
      });

      setAgents(combinedData);
    } catch (err: any) {
      console.error("Error fetching agents:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const paginatedAgents = agents.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const totalPages = Math.ceil(agents.length / itemsPerPage);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-6 md:py-8 pb-24 md:pb-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2">Directorio de Agentes e Inmobiliarias</h1>
          <p className="text-muted-foreground">
            Encuentra los mejores profesionales inmobiliarios verificados en México
          </p>
        </div>

        <AgentSearchBar
          filters={filters}
          onFiltersChange={setFilters}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-48 w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : paginatedAgents.length === 0 ? (
          <div className="text-center py-16">
            <AlertCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">No se encontraron resultados</h2>
            <p className="text-muted-foreground mb-6">
              {filters.state || filters.municipality
                ? "Intenta ampliar tu búsqueda o explorar otras ubicaciones"
                : "No hay agentes disponibles en este momento"}
            </p>
            {(filters.state || filters.municipality || filters.type !== "all") && (
              <button
                onClick={() => setFilters({
                  state: "",
                  municipality: "",
                  type: "all",
                  minRating: 0,
                  minProperties: 0,
                  plan: "all",
                })}
                className="text-primary hover:underline"
              >
                Ver todos los agentes
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {paginatedAgents.map((agent) => (
                <AgentCard key={agent.id} {...agent} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 rounded-md bg-secondary text-secondary-foreground disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="px-4 py-2">
                  Página {page} de {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 rounded-md bg-secondary text-secondary-foreground disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DirectorioAgentes;
