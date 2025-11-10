import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AgentCard from "@/components/AgentCard";
import AgentSearchBar from "@/components/AgentSearchBar";
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
      // Fetch individual agents
      let agentsQuery = supabase
        .from("profiles")
        .select(`
          id,
          name,
          is_verified,
          user_roles!inner(role),
          properties(id, status, state, municipality),
          agent_reviews:agent_reviews!agent_id(rating),
          user_subscriptions!inner(
            status,
            subscription_plans(display_name, name)
          ),
          user_badges(
            badge_code,
            badge_definitions(code, name, description, icon, color, priority, is_secret)
          )
        `)
        .eq("user_roles.role", "agent");

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
          owner_id,
          agency_agents!inner(agent_id),
          user_subscriptions!owner_id(
            status,
            subscription_plans(display_name, name)
          )
        `);

      const [agentsResult, agenciesResult] = await Promise.all([
        agentsQuery,
        agenciesQuery,
      ]);

      if (agentsResult.error) throw agentsResult.error;
      if (agenciesResult.error) throw agenciesResult.error;

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

        const subscription = profile.user_subscriptions?.[0];
        const badges = profile.user_badges?.map((ub: any) => ub.badge_definitions).filter(Boolean) || [];

        return {
          id: profile.id,
          name: profile.name,
          type: 'agent',
          role: profile.user_roles?.[0]?.role || 'agent',
          city: mostFrequentCity,
          state: mostFrequentState,
          active_properties: activeProperties.length,
          avg_rating: avgRating,
          total_reviews: reviews.length,
          is_verified: profile.is_verified || false,
          plan_name: subscription?.subscription_plans?.display_name || null,
          plan_level: subscription?.subscription_plans?.name || null,
          badges,
        };
      });

      // Process agencies
      const processedAgencies: AgentData[] = await Promise.all(
        (agenciesResult.data || []).map(async (agency: any) => {
          const agentIds = agency.agency_agents?.map((aa: any) => aa.agent_id) || [];
          
          // Fetch properties for agency agents
          const { data: properties } = await supabase
            .from("properties")
            .select("id, status, agent_id")
            .in("agent_id", agentIds)
            .eq("status", "activa");

          // Fetch reviews for agency agents
          const { data: reviews } = await supabase
            .from("agent_reviews")
            .select("rating")
            .in("agent_id", agentIds);

          const activeProperties = properties?.length || 0;
          const avgRating = reviews && reviews.length > 0
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
            : null;

          const subscription = agency.user_subscriptions?.[0];

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
            plan_name: subscription?.subscription_plans?.display_name || null,
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

      // Función para calcular score de badges
      const getBadgeScore = (badges: BadgeData[]) => {
        if (!badges || badges.length === 0) return 0;
        return badges.reduce((sum, badge) => sum + badge.priority, 0);
      };

      // Apply sorting - prioritize by badge score, then plan level, then secondary sort
      combinedData.sort((a, b) => {
        const aBadgeScore = getBadgeScore(a.badges);
        const bBadgeScore = getBadgeScore(b.badges);
        
        // First sort by badge score (highest priority badges first)
        if (aBadgeScore !== bBadgeScore) return bBadgeScore - aBadgeScore;
        
        const aLevel = getPlanLevel(a.plan_level);
        const bLevel = getPlanLevel(b.plan_level);
        
        // Second sort by plan level (featured agents first)
        if (aLevel !== bLevel) return bLevel - aLevel;
        
        // Then apply secondary sorting
        if (sortBy === "active") {
          return b.active_properties - a.active_properties;
        }
        if (sortBy === "rating") {
          return (b.avg_rating || 0) - (a.avg_rating || 0);
        }
        return 0; // recent - would need created_at field
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
      <div className="container mx-auto px-4 py-8">        
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Directorio de Agentes e Inmobiliarias</h1>
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
