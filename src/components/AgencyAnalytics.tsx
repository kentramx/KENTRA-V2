import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, Eye, Heart, MessageSquare, Home, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMonitoring } from '@/lib/monitoring';

interface AgencyAnalyticsProps {
  agencyId: string;
}

export const AgencyAnalytics = ({ agencyId }: AgencyAnalyticsProps) => {
  const { toast } = useToast();
  const { error: logError, captureException } = useMonitoring();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProperties: 0,
    activeProperties: 0,
    totalViews: 0,
    totalFavorites: 0,
    totalConversations: 0,
    totalAgents: 0,
    conversionRate: 0,
  });

  useEffect(() => {
    fetchAgencyStats();
  }, [agencyId]);

  const fetchAgencyStats = async () => {
    try {
      // Obtener agentes de la agencia
      const { data: agentsData, error: agentsError } = await supabase
        .from('agency_agents')
        .select('agent_id')
        .eq('agency_id', agencyId)
        .eq('status', 'active');

      if (agentsError) throw agentsError;

      const agentIds = agentsData?.map(a => a.agent_id) || [];

      // Obtener propiedades
      const { data: propertiesData, error: propertiesError } = await supabase
        .from('properties')
        .select('id, status')
        .eq('agency_id', agencyId);

      if (propertiesError) throw propertiesError;

      const propertyIds = propertiesData?.map(p => p.id) || [];

      // Obtener vistas
      const { data: viewsData, error: viewsError } = await supabase
        .from('property_views')
        .select('id')
        .in('property_id', propertyIds);

      // Obtener favoritos
      const { data: favoritesData, error: favoritesError } = await supabase
        .from('favorites')
        .select('id')
        .in('property_id', propertyIds);

      // Obtener conversaciones
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('conversations')
        .select('id')
        .in('agent_id', agentIds);

      const totalViews = viewsData?.length || 0;
      const totalFavorites = favoritesData?.length || 0;
      const totalConversations = conversationsData?.length || 0;
      const conversionRate = totalViews > 0 
        ? ((totalConversations / totalViews) * 100) 
        : 0;

      setStats({
        totalProperties: propertiesData?.length || 0,
        activeProperties: propertiesData?.filter(p => p.status === 'activa').length || 0,
        totalViews,
        totalFavorites,
        totalConversations,
        totalAgents: agentIds.length,
        conversionRate,
      });
    } catch (error) {
      logError('Error fetching agency stats', {
        component: 'AgencyAnalytics',
        agencyId,
        error,
      });
      captureException(error as Error, {
        component: 'AgencyAnalytics',
        action: 'fetchAgencyStats',
        agencyId,
      });
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las estadísticas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Reportes Consolidados</h3>
        <p className="text-sm text-muted-foreground">
          Estadísticas de rendimiento de toda la inmobiliaria
        </p>
      </div>

      {/* Grid de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Propiedades</CardTitle>
            <Home className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalProperties}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.activeProperties} activas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agentes Activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalAgents}
            </div>
            <p className="text-xs text-muted-foreground">
              Miembros del equipo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vistas</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalViews}
            </div>
            <p className="text-xs text-muted-foreground">
              En todas las propiedades
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Favoritos</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalFavorites}
            </div>
            <p className="text-xs text-muted-foreground">
              Usuarios interesados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversaciones</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalConversations}
            </div>
            <p className="text-xs text-muted-foreground">
              Leads activos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Conversión</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.conversionRate.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Vistas a contactos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Métricas adicionales */}
      <Card>
        <CardHeader>
          <CardTitle>Rendimiento del Equipo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <span className="text-sm font-medium">Promedio de vistas por propiedad</span>
              <span className="text-2xl font-bold">
                {stats.totalProperties > 0 
                  ? Math.round(stats.totalViews / stats.totalProperties)
                  : 0
                }
              </span>
            </div>
            <div className="flex items-center justify-between border-b pb-3">
              <span className="text-sm font-medium">Propiedades por agente</span>
              <span className="text-2xl font-bold">
                {stats.totalAgents > 0 
                  ? Math.round(stats.totalProperties / stats.totalAgents)
                  : 0
                }
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Leads por agente</span>
              <span className="text-2xl font-bold">
                {stats.totalAgents > 0 
                  ? Math.round(stats.totalConversations / stats.totalAgents)
                  : 0
                }
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
