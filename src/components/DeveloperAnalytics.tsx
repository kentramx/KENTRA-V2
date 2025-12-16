import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, Eye, Heart, MessageSquare, Building2, Users, Home } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMonitoring } from '@/lib/monitoring';

interface DeveloperAnalyticsProps {
  developerId: string;
}

export const DeveloperAnalytics = ({ developerId }: DeveloperAnalyticsProps) => {
  const { toast } = useToast();
  const { error: logError, captureException } = useMonitoring();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeProjects: 0,
    totalUnits: 0,
    availableUnits: 0,
    totalProperties: 0,
    totalViews: 0,
    totalFavorites: 0,
    totalConversations: 0,
    totalTeamMembers: 0,
    conversionRate: 0,
  });

  useEffect(() => {
    fetchDeveloperStats();
  }, [developerId]);

  const fetchDeveloperStats = async () => {
    try {
      // Obtener proyectos del desarrollador
      const { data: projectsData, error: projectsError } = await supabase
        .from('developer_projects')
        .select('id, status, total_units, available_units')
        .eq('developer_id', developerId);

      if (projectsError) throw projectsError;

      const projectIds = projectsData?.map(p => p.id) || [];
      const totalUnits = projectsData?.reduce((acc, p) => acc + (p.total_units || 0), 0) || 0;
      const availableUnits = projectsData?.reduce((acc, p) => acc + (p.available_units || 0), 0) || 0;

      // Obtener miembros del equipo
      const { data: teamData, error: teamError } = await supabase
        .from('developer_team')
        .select('id')
        .eq('developer_id', developerId)
        .eq('status', 'active');

      // Obtener propiedades de los proyectos
      let propertyIds: string[] = [];
      let totalProperties = 0;
      
      if (projectIds.length > 0) {
        const { data: propertiesData, error: propertiesError } = await supabase
          .from('properties')
          .select('id')
          .in('project_id', projectIds);

        if (!propertiesError && propertiesData) {
          propertyIds = propertiesData.map(p => p.id);
          totalProperties = propertiesData.length;
        }
      }

      // Obtener vistas
      let totalViews = 0;
      if (propertyIds.length > 0) {
        const { data: viewsData } = await supabase
          .from('property_views')
          .select('id')
          .in('property_id', propertyIds);
        totalViews = viewsData?.length || 0;
      }

      // Obtener favoritos
      let totalFavorites = 0;
      if (propertyIds.length > 0) {
        const { data: favoritesData } = await supabase
          .from('favorites')
          .select('id')
          .in('property_id', propertyIds);
        totalFavorites = favoritesData?.length || 0;
      }

      // Obtener conversaciones (a través del owner del developer)
      const { data: developerData } = await supabase
        .from('developers')
        .select('owner_id')
        .eq('id', developerId)
        .single();

      let totalConversations = 0;
      if (developerData?.owner_id) {
        const { data: conversationsData } = await supabase
          .from('conversations')
          .select('id')
          .eq('agent_id', developerData.owner_id);
        totalConversations = conversationsData?.length || 0;
      }

      const conversionRate = totalViews > 0 
        ? ((totalConversations / totalViews) * 100) 
        : 0;

      setStats({
        totalProjects: projectsData?.length || 0,
        activeProjects: projectsData?.filter(p => ['presale', 'sale'].includes(p.status)).length || 0,
        totalUnits,
        availableUnits,
        totalProperties,
        totalViews,
        totalFavorites,
        totalConversations,
        totalTeamMembers: teamData?.length || 0,
        conversionRate,
      });
    } catch (error) {
      logError('Error fetching developer stats', {
        component: 'DeveloperAnalytics',
        developerId,
        error,
      });
      captureException(error as Error, {
        component: 'DeveloperAnalytics',
        action: 'fetchDeveloperStats',
        developerId,
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
        <h3 className="text-lg font-semibold mb-2">Reportes de Desarrolladora</h3>
        <p className="text-sm text-muted-foreground">
          Estadísticas de rendimiento de todos tus proyectos
        </p>
      </div>

      {/* Grid de estadísticas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proyectos</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalProjects}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.activeProjects} en venta/preventa
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unidades Totales</CardTitle>
            <Home className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalUnits}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.availableUnits} disponibles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Miembros del Equipo</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalTeamMembers}
            </div>
            <p className="text-xs text-muted-foreground">
              Colaboradores activos
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
              En propiedades publicadas
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
          <CardTitle>Rendimiento General</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <span className="text-sm font-medium">Tasa de ocupación</span>
              <span className="text-2xl font-bold">
                {stats.totalUnits > 0 
                  ? (((stats.totalUnits - stats.availableUnits) / stats.totalUnits) * 100).toFixed(1)
                  : 0
                }%
              </span>
            </div>
            <div className="flex items-center justify-between border-b pb-3">
              <span className="text-sm font-medium">Unidades promedio por proyecto</span>
              <span className="text-2xl font-bold">
                {stats.totalProjects > 0 
                  ? Math.round(stats.totalUnits / stats.totalProjects)
                  : 0
                }
              </span>
            </div>
            <div className="flex items-center justify-between border-b pb-3">
              <span className="text-sm font-medium">Vistas promedio por propiedad</span>
              <span className="text-2xl font-bold">
                {stats.totalProperties > 0 
                  ? Math.round(stats.totalViews / stats.totalProperties)
                  : 0
                }
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Contactos totales</span>
              <span className="text-2xl font-bold">
                {stats.totalConversations}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
