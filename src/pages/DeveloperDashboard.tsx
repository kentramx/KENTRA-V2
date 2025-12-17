import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useRoleImpersonation } from '@/hooks/useRoleImpersonation';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, FolderKanban, Users, BarChart3, 
  CreditCard, AlertCircle, RefreshCcw, Package 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DynamicBreadcrumbs } from '@/components/DynamicBreadcrumbs';
import { SubscriptionManagement } from '@/components/SubscriptionManagement';
import { EmailVerificationRequired } from '@/components/EmailVerificationRequired';
import { DeveloperProjectManagement } from '@/components/DeveloperProjectManagement';
import { DeveloperTeamManagement } from '@/components/DeveloperTeamManagement';
import { DeveloperAnalytics } from '@/components/DeveloperAnalytics';
import { 
  CompactDashboardHeader,
  PremiumMetricsCards,
  PremiumSubscriptionCard 
} from '@/components/dashboard';

const DeveloperDashboard = () => {
  const { user, loading: authLoading, isEmailVerified } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { isImpersonating, impersonatedRole, getDemoUserId, getDemoDeveloperId } = useRoleImpersonation();
  const emailVerified = isEmailVerified();
  const [loading, setLoading] = useState(true);
  const [developer, setDeveloper] = useState<any>(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState<any>(null);
  const [reactivating, setReactivating] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get('tab');
    const validTabs = ['projects', 'team', 'analytics', 'plan'];
    return tabParam && validTabs.includes(tabParam) ? tabParam : 'projects';
  });

  // Sincronizar activeTab cuando cambia la URL
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const validTabs = ['projects', 'team', 'analytics', 'plan'];
    if (tabParam && validTabs.includes(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);
  
  // Si está simulando rol developer, usar owner/developer demo
  const effectiveOwnerId = (isImpersonating && impersonatedRole === 'developer') 
    ? getDemoUserId() 
    : user?.id;
  const effectiveDeveloperId = (isImpersonating && impersonatedRole === 'developer')
    ? getDemoDeveloperId()
    : developer?.id;

  // Fetch projects count
  const { data: projectsCount = 0 } = useQuery({
    queryKey: ['developer-projects-count', effectiveDeveloperId],
    queryFn: async () => {
      if (!effectiveDeveloperId) return 0;
      const { count } = await supabase
        .from('developer_projects')
        .select('*', { count: 'exact', head: true })
        .eq('developer_id', effectiveDeveloperId)
        .in('status', ['active', 'pre_sale', 'construction']);
      return count || 0;
    },
    enabled: !!effectiveDeveloperId,
  });

  // Fetch team members count
  const { data: teamMembersCount = 0 } = useQuery({
    queryKey: ['developer-team-count', effectiveDeveloperId],
    queryFn: async () => {
      if (!effectiveDeveloperId) return 0;
      const { count } = await supabase
        .from('developer_team')
        .select('*', { count: 'exact', head: true })
        .eq('developer_id', effectiveDeveloperId)
        .eq('status', 'active');
      return count || 0;
    },
    enabled: !!effectiveDeveloperId,
  });

  // Fetch total views for developer's projects/properties
  const { data: totalViews = 0 } = useQuery({
    queryKey: ['developer-total-views', effectiveDeveloperId],
    queryFn: async () => {
      if (!effectiveDeveloperId) return 0;
      
      // Get all project IDs for this developer
      const { data: projectIds } = await supabase
        .from('developer_projects')
        .select('id')
        .eq('developer_id', effectiveDeveloperId);
      
      if (!projectIds?.length) return 0;
      
      // Get properties linked to these projects
      const { data: propertyIds } = await supabase
        .from('properties')
        .select('id')
        .in('project_id', projectIds.map(p => p.id));
      
      if (!propertyIds?.length) return 0;
      
      // Count total views
      const { count } = await supabase
        .from('property_views')
        .select('*', { count: 'exact', head: true })
        .in('property_id', propertyIds.map(p => p.id));
      
      return count || 0;
    },
    enabled: !!effectiveDeveloperId,
    staleTime: 60 * 1000,
  });

  // Pending reminders
  const pendingReminders = useMemo(() => {
    return 0; // Could be enhanced to count actual project deadlines
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    if (user) {
      checkDeveloperStatus();
    }
  }, [user, authLoading, navigate, isImpersonating, impersonatedRole]);

  const checkDeveloperStatus = async () => {
    const localImpersonated = localStorage.getItem('kentra_impersonated_role');
    const isLocalSimulatingDeveloper = localImpersonated === 'developer';
    const DEMO_OWNER_ID = '00000000-0000-0000-0000-000000000020';
    const DEMO_DEVELOPER_ID = '30000000-0000-0000-0000-000000000001';

    if (isLocalSimulatingDeveloper) {
      try {
        const ownerId = DEMO_OWNER_ID;
        const developerId = DEMO_DEVELOPER_ID;

        const { data: developerData } = await supabase
          .from('developers')
          .select('*')
          .eq('owner_id', ownerId)
          .single();

        setDeveloper(developerData || { 
          name: 'Kentra Desarrollos Demo', 
          owner_id: ownerId, 
          id: developerId 
        });

        const { data: subInfo } = await supabase.rpc('get_user_subscription_info', { user_uuid: ownerId });
        if (subInfo && subInfo.length > 0) setSubscriptionInfo(subInfo[0]);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!effectiveOwnerId) {
      setLoading(false);
      return;
    }

    try {
      if (isImpersonating && impersonatedRole === 'developer') {
        const ownerId = getDemoUserId() || DEMO_OWNER_ID;
        const developerId = getDemoDeveloperId() || DEMO_DEVELOPER_ID;

        const { data: developerData } = await supabase
          .from('developers')
          .select('*')
          .eq('owner_id', ownerId)
          .single();
        
        setDeveloper(developerData || { 
          name: 'Kentra Desarrollos Demo', 
          owner_id: ownerId, 
          id: developerId 
        });

        const { data: subInfo } = await supabase.rpc('get_user_subscription_info', { user_uuid: ownerId });
        if (subInfo && subInfo.length > 0) setSubscriptionInfo(subInfo[0]);
        
        setLoading(false);
        return;
      }

      // Verificar rol de desarrolladora
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id)
        .eq('role', 'developer')
        .single();

      if (roleError || !roleData) {
        toast({
          title: 'Acceso denegado',
          description: 'Solo las desarrolladoras pueden acceder a esta página',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      // Obtener datos de la desarrolladora
      const { data: developerData, error: developerError } = await supabase
        .from('developers')
        .select('*')
        .eq('owner_id', user?.id)
        .single();

      if (developerError) throw developerError;

      setDeveloper(developerData);

      // Obtener información de suscripción
      const { data: subInfo, error: subError } = await supabase.rpc('get_user_subscription_info', {
        user_uuid: user?.id,
      });

      if (!subError && subInfo && subInfo.length > 0) {
        setSubscriptionInfo(subInfo[0]);
      }
    } catch (error) {
      console.error('Error checking developer status:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los datos de la desarrolladora',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReactivateSubscription = async () => {
    setReactivating(true);
    try {
      const { data, error } = await supabase.functions.invoke('reactivate-subscription');
      
      if (error) throw error;
      
      if (!data.success) {
        toast({
          title: "No se puede reactivar",
          description: data.error || "Esta suscripción no puede ser reactivada.",
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "¡Suscripción reactivada!",
        description: data.message || "Tu suscripción ha sido reactivada exitosamente.",
      });
      
      // Refresh subscription info
      if (effectiveOwnerId) {
        const { data: subInfo } = await supabase.rpc('get_user_subscription_info', { 
          user_uuid: effectiveOwnerId 
        });
        if (subInfo && subInfo.length > 0) {
          setSubscriptionInfo(subInfo[0]);
        }
      }
    } catch (error: any) {
      console.error('Error reactivating subscription:', error);
      toast({
        title: "Error al reactivar",
        description: error.message || "No se pudo reactivar tu suscripción.",
        variant: "destructive",
      });
    } finally {
      setReactivating(false);
    }
  };

  const handleGoToPricing = () => {
    navigate('/pricing-desarrolladora');
  };

  const handleNewProject = () => {
    // Navigate to projects tab
    setActiveTab('projects');
    toast({
      title: 'Nuevo Proyecto',
      description: 'Crea un nuevo proyecto de desarrollo',
    });
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando tu panel...</p>
        </div>
      </div>
    );
  }

  if (!developer) {
    return null;
  }

  // Tab configuration with icons and badges
  const tabs = [
    { 
      value: 'projects', 
      label: 'Proyectos', 
      icon: FolderKanban,
      badge: projectsCount > 0 ? projectsCount : null,
    },
    { 
      value: 'team', 
      label: 'Equipo', 
      icon: Users,
      badge: teamMembersCount > 0 ? teamMembersCount : null,
    },
    { 
      value: 'analytics', 
      label: 'Reportes', 
      icon: BarChart3,
      badge: null,
    },
    { 
      value: 'plan', 
      label: 'Mi Plan', 
      icon: Package,
      badge: null,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <Navbar />

      <main className="container mx-auto px-4 py-6 md:py-8 pb-24 md:pb-8">
        {/* Breadcrumbs */}
        <DynamicBreadcrumbs 
          items={[
            { label: 'Inicio', href: '/', active: false },
            { label: 'Panel de Desarrolladora', href: '', active: true }
          ]} 
          className="mb-4" 
        />

        {/* Compact Header - Premium Look */}
        <CompactDashboardHeader
          profileName={developer?.name || 'Desarrolladora'}
          planName={subscriptionInfo?.name}
          planDisplayName={subscriptionInfo?.display_name}
          dashboardType="developer"
          projectsCount={projectsCount}
          teamMembersCount={teamMembersCount}
          totalViews={totalViews}
          pendingReminders={pendingReminders}
          onNewProperty={handleNewProject}
          newButtonLabel="Nuevo Proyecto"
          subscriptionInfo={{
            status: subscriptionInfo?.status,
            planName: subscriptionInfo?.name,
            currentPeriodEnd: subscriptionInfo?.current_period_end,
            maxProjects: subscriptionInfo?.max_projects || 5,
            maxAgents: subscriptionInfo?.max_agents || 10,
          }}
        />

        {/* Alerts Section - Only show when critical */}
        {subscriptionInfo?.status === 'canceled' && subscriptionInfo?.cancel_at_period_end && (
          <Alert className="mb-4 border-destructive/50 bg-destructive/10 rounded-xl">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <AlertTitle className="font-semibold text-destructive">Suscripción Cancelada</AlertTitle>
            <AlertDescription className="mt-1 flex items-center justify-between gap-4 flex-wrap">
              <span className="text-sm text-muted-foreground">
                Se cancelará el{' '}
                <span className="font-medium text-foreground">
                  {new Date(subscriptionInfo.current_period_end).toLocaleDateString('es-MX', {
                    day: 'numeric',
                    month: 'short'
                  })}
                </span>
              </span>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleReactivateSubscription}
                  disabled={reactivating}
                  size="sm"
                  className="bg-primary hover:bg-primary/90"
                >
                  {reactivating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-1" />}
                  Reactivar
                </Button>
                <Button onClick={handleGoToPricing} size="sm" variant="outline">
                  Nuevo Plan
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {subscriptionInfo?.status === 'canceled' && !subscriptionInfo?.cancel_at_period_end && (
          <Alert className="mb-4 border-destructive/50 bg-destructive/10 rounded-xl">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <AlertTitle className="font-semibold text-destructive">Suscripción Expirada</AlertTitle>
            <AlertDescription className="mt-1 flex items-center justify-between gap-4 flex-wrap">
              <span className="text-sm text-muted-foreground">
                Tu suscripción ha expirado. Contrata un nuevo plan para continuar.
              </span>
              <Button onClick={handleGoToPricing} size="sm" className="bg-primary hover:bg-primary/90">
                Contratar Plan
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Email Verification Banner */}
        {!emailVerified && (
          <div className="mb-4">
            <EmailVerificationRequired />
          </div>
        )}

        {/* Main Tabs Card */}
        <Card id="dashboard-tabs" className="border-border shadow-xl bg-card scroll-mt-4">
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              {/* Premium Tab Header */}
              <div className="border-b border-border bg-gradient-to-r from-muted/50 via-background to-muted/50 p-4 md:p-6">
                <TabsList className="w-full flex flex-wrap h-auto gap-2 bg-transparent p-0">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.value;
                    return (
                      <TabsTrigger 
                        key={tab.value}
                        value={tab.value}
                        className={`
                          relative flex-1 min-w-[90px] flex items-center justify-center gap-2 
                          px-4 py-3 rounded-xl font-medium text-sm
                          transition-all duration-200
                          ${isActive 
                            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' 
                            : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border'
                          }
                          data-[state=active]:bg-primary data-[state=active]:text-primary-foreground
                        `}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="hidden sm:inline">{tab.label}</span>
                        {tab.badge && (
                          <Badge 
                            variant="secondary"
                            className={`ml-1 h-5 min-w-[20px] px-1.5 text-[10px] font-bold ${
                              isActive ? 'bg-white/20 text-white' : ''
                            }`}
                          >
                            {tab.badge}
                          </Badge>
                        )}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>
              
              {/* Tab Content Area */}
              <div className="p-4 md:p-6">
                <TabsContent value="projects" className="mt-0">
                  <DeveloperProjectManagement 
                    developerId={effectiveDeveloperId || developer?.id || ''} 
                    subscriptionInfo={subscriptionInfo}
                  />
                </TabsContent>

                <TabsContent value="team" className="mt-0">
                  <DeveloperTeamManagement 
                    developerId={effectiveDeveloperId || developer?.id || ''} 
                    subscriptionInfo={subscriptionInfo}
                  />
                </TabsContent>

                <TabsContent value="analytics" className="mt-0">
                  <DeveloperAnalytics developerId={effectiveDeveloperId || developer?.id || ''} />
                </TabsContent>

                <TabsContent value="plan" className="mt-0 space-y-6">
                  {/* Plan Overview Grid */}
                  <div className="grid gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-1">
                      <PremiumSubscriptionCard
                        subscriptionInfo={subscriptionInfo}
                        userRole="developer"
                        activePropertiesCount={projectsCount}
                        featuredCount={0}
                        onManage={() => {}}
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <PremiumMetricsCards
                        subscriptionInfo={subscriptionInfo}
                        activePropertiesCount={projectsCount}
                        featuredCount={0}
                      />
                    </div>
                  </div>
                  {/* Subscription Management */}
                  <SubscriptionManagement userId={effectiveOwnerId || ''} userRole="developer" />
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default DeveloperDashboard;
