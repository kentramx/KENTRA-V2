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
  Loader2, Building2, Users, BarChart3, History, 
  CreditCard, AlertCircle, RefreshCcw, Package 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DynamicBreadcrumbs } from '@/components/DynamicBreadcrumbs';
import { AgencyTeamManagement } from '@/components/AgencyTeamManagement';
import { AgencyInventory } from '@/components/AgencyInventory';
import { AgencyAnalytics } from '@/components/AgencyAnalytics';
import { PropertyAssignmentHistory } from '@/components/PropertyAssignmentHistory';
import { SubscriptionManagement } from '@/components/SubscriptionManagement';
import { EmailVerificationRequired } from '@/components/EmailVerificationRequired';
import { 
  CompactDashboardHeader,
  PremiumMetricsCards,
  PremiumSubscriptionCard 
} from '@/components/dashboard';

const AgencyDashboard = () => {
  const { user, loading: authLoading, isEmailVerified } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { isImpersonating, impersonatedRole, getDemoUserId, getDemoAgencyId } = useRoleImpersonation();
  const emailVerified = isEmailVerified();
  const [loading, setLoading] = useState(true);
  const [agency, setAgency] = useState<any>(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState<any>(null);
  const [reactivating, setReactivating] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get('tab');
    const validTabs = ['inventory', 'team', 'analytics', 'history', 'plan'];
    return tabParam && validTabs.includes(tabParam) ? tabParam : 'inventory';
  });

  // Sincronizar activeTab cuando cambia la URL
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const validTabs = ['inventory', 'team', 'analytics', 'history', 'plan'];
    if (tabParam && validTabs.includes(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);
  
  // Si está simulando rol agency, usar owner/agency demo; si no, usar user real
  const effectiveOwnerId = (isImpersonating && impersonatedRole === 'agency') 
    ? getDemoUserId() 
    : user?.id;
  const effectiveAgencyId = (isImpersonating && impersonatedRole === 'agency')
    ? getDemoAgencyId()
    : agency?.id;

  // Fetch inventory count
  const { data: inventoryCount = 0 } = useQuery({
    queryKey: ['agency-inventory-count', effectiveAgencyId],
    queryFn: async () => {
      if (!effectiveAgencyId) return 0;
      const { count } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', effectiveAgencyId)
        .eq('status', 'activa');
      return count || 0;
    },
    enabled: !!effectiveAgencyId,
  });

  // Fetch team agents count
  const { data: teamAgentsCount = 0 } = useQuery({
    queryKey: ['agency-team-count', effectiveAgencyId],
    queryFn: async () => {
      if (!effectiveAgencyId) return 0;
      const { count } = await supabase
        .from('agency_agents')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', effectiveAgencyId)
        .eq('status', 'active');
      return count || 0;
    },
    enabled: !!effectiveAgencyId,
  });

  // Fetch total views for agency's properties
  const { data: totalViews = 0 } = useQuery({
    queryKey: ['agency-total-views', effectiveAgencyId],
    queryFn: async () => {
      if (!effectiveAgencyId) return 0;
      const { data: propertyIds } = await supabase
        .from('properties')
        .select('id')
        .eq('agency_id', effectiveAgencyId);
      
      if (!propertyIds?.length) return 0;
      
      const { count } = await supabase
        .from('property_views')
        .select('*', { count: 'exact', head: true })
        .in('property_id', propertyIds.map(p => p.id));
      
      return count || 0;
    },
    enabled: !!effectiveAgencyId,
    staleTime: 60 * 1000,
  });

  // Fetch pending reminders count
  const pendingReminders = useMemo(() => {
    // For agencies, count properties expiring soon
    return 0; // Could be enhanced to count actual reminders
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    if (user) {
      checkAgencyStatus();
    }
  }, [user, authLoading, navigate, isImpersonating, impersonatedRole]);

  const checkAgencyStatus = async () => {
    // Chequeo sincronizado inmediato por localStorage para evitar carreras
    const localImpersonated = localStorage.getItem('kentra_impersonated_role');
    const isLocalSimulatingAgency = localImpersonated === 'agency';
    const DEMO_OWNER_ID = '00000000-0000-0000-0000-000000000010';
    const DEMO_AGENCY_ID = '20000000-0000-0000-0000-000000000001';

    if (isLocalSimulatingAgency) {
      try {
        const ownerId = DEMO_OWNER_ID;
        const agencyId = DEMO_AGENCY_ID;

        const { data: agencyData } = await supabase
          .from('agencies')
          .select('*')
          .eq('owner_id', ownerId)
          .single();

        setAgency(agencyData || { name: 'Kentra Inmobiliaria Demo', owner_id: ownerId, id: agencyId });

        const { data: subInfo } = await supabase.rpc('get_user_subscription_info' as any, { user_uuid: ownerId });
        if (subInfo && Array.isArray(subInfo) && subInfo.length > 0) setSubscriptionInfo(subInfo[0]);
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
      if (isImpersonating && impersonatedRole === 'agency') {
        const ownerId = getDemoUserId() || DEMO_OWNER_ID;
        const agencyId = getDemoAgencyId() || DEMO_AGENCY_ID;

        const { data: agencyData } = await supabase
          .from('agencies')
          .select('*')
          .eq('owner_id', ownerId)
          .single();
        
        setAgency(agencyData || { name: 'Kentra Inmobiliaria Demo', owner_id: ownerId, id: agencyId });

        const { data: subInfo } = await supabase.rpc('get_user_subscription_info' as any, { user_uuid: ownerId });
        if (subInfo && Array.isArray(subInfo) && subInfo.length > 0) setSubscriptionInfo(subInfo[0]);
        
        setLoading(false);
        return;
      }

      // Verificar rol de agencia
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id)
        .eq('role', 'agency')
        .single();

      if (roleError || !roleData) {
        toast({
          title: 'Acceso denegado',
          description: 'Solo las inmobiliarias pueden acceder a esta página',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      // Obtener datos de la agencia
      const { data: agencyData, error: agencyError } = await supabase
        .from('agencies')
        .select('*')
        .eq('owner_id', user?.id)
        .single();

      if (agencyError) throw agencyError;

      setAgency(agencyData);

      // Obtener información de suscripción
      const { data: subInfo, error: subError } = await supabase.rpc('get_user_subscription_info' as any, {
        user_uuid: user?.id,
      });

      if (!subError && subInfo && Array.isArray(subInfo) && subInfo.length > 0) {
        setSubscriptionInfo(subInfo[0]);
      }
    } catch (error) {
      console.error('Error checking agency status:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los datos de la inmobiliaria',
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
        const { data: subInfo } = await supabase.rpc('get_user_subscription_info' as any, { 
          user_uuid: effectiveOwnerId 
        });
        if (subInfo && Array.isArray(subInfo) && subInfo.length > 0) {
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
    navigate('/pricing-inmobiliaria');
  };

  const handleNewProperty = () => {
    // Navigate to inventory tab or show form
    setActiveTab('inventory');
    toast({
      title: 'Nueva Propiedad',
      description: 'Asigna una propiedad desde el inventario compartido',
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

  if (!agency) {
    return null;
  }

  // Tab configuration with icons and badges
  const tabs = [
    { 
      value: 'inventory', 
      label: 'Inventario', 
      icon: Building2,
      badge: inventoryCount > 0 ? inventoryCount : null,
    },
    { 
      value: 'team', 
      label: 'Equipo', 
      icon: Users,
      badge: teamAgentsCount > 0 ? teamAgentsCount : null,
    },
    { 
      value: 'analytics', 
      label: 'Reportes', 
      icon: BarChart3,
      badge: null,
    },
    { 
      value: 'history', 
      label: 'Historial', 
      icon: History,
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
            { label: 'Panel de Inmobiliaria', href: '', active: true }
          ]} 
          className="mb-4" 
        />

        {/* Compact Header - Premium Look */}
        <CompactDashboardHeader
          profileName={agency?.name || 'Inmobiliaria'}
          planName={subscriptionInfo?.name}
          planDisplayName={subscriptionInfo?.display_name}
          dashboardType="agency"
          inventoryCount={inventoryCount}
          teamAgentsCount={teamAgentsCount}
          totalViews={totalViews}
          pendingReminders={pendingReminders}
          onNewProperty={handleNewProperty}
          subscriptionInfo={{
            status: subscriptionInfo?.status,
            planName: subscriptionInfo?.name,
            currentPeriodEnd: subscriptionInfo?.current_period_end,
            maxProperties: subscriptionInfo?.properties_limit || 20,
            maxAgents: subscriptionInfo?.max_agents || 5,
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
                <TabsContent value="inventory" className="mt-0">
                  <AgencyInventory 
                    agencyId={effectiveAgencyId || agency?.id || ''} 
                    subscriptionInfo={subscriptionInfo}
                  />
                </TabsContent>

                <TabsContent value="team" className="mt-0">
                  <AgencyTeamManagement 
                    agencyId={effectiveAgencyId || agency?.id || ''} 
                    subscriptionInfo={subscriptionInfo}
                  />
                </TabsContent>

                <TabsContent value="analytics" className="mt-0">
                  <AgencyAnalytics agencyId={effectiveAgencyId || agency?.id || ''} />
                </TabsContent>

                <TabsContent value="history" className="mt-0">
                  <PropertyAssignmentHistory agencyId={effectiveAgencyId || agency?.id || ''} />
                </TabsContent>

                <TabsContent value="plan" className="mt-0 space-y-6">
                  {/* Plan Overview Grid */}
                  <div className="grid gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-1">
                      <PremiumSubscriptionCard
                        subscriptionInfo={subscriptionInfo}
                        userRole="agency"
                        activePropertiesCount={inventoryCount}
                        featuredCount={0}
                        onManage={() => {}}
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <PremiumMetricsCards
                        subscriptionInfo={subscriptionInfo}
                        activePropertiesCount={inventoryCount}
                        featuredCount={0}
                      />
                    </div>
                  </div>
                  {/* Subscription Management */}
                  <SubscriptionManagement userId={effectiveOwnerId || ''} userRole="agency" />
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AgencyDashboard;
