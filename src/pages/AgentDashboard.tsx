import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useAgentProperties } from '@/hooks/useAgentProperties';
import { useRoleImpersonation } from '@/hooks/useRoleImpersonation';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Home, BarChart3, Bell, Sparkles, CreditCard, FileEdit, AlertCircle, RefreshCcw, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PropertyFormWizard } from '@/components/property-form/PropertyFormWizard';
import AgentPropertyList from '@/components/AgentPropertyList';
import { AgentAnalytics } from '@/components/AgentAnalytics';
import { DynamicBreadcrumbs } from '@/components/DynamicBreadcrumbs';
import { SubscriptionManagement } from '@/components/SubscriptionManagement';
import { PropertyExpiryReminders } from '@/components/PropertyExpiryReminders';
import { EmailVerificationRequired } from '@/components/EmailVerificationRequired';
import { QuickUpsells } from '@/components/QuickUpsells';
import { AgentUpsells } from '@/components/AgentUpsells';
import { SubscriptionGate } from '@/components/subscription/SubscriptionGate';
import { 
  CompactDashboardHeader,
  PremiumMetricsCards,
  PremiumSubscriptionCard 
} from '@/components/dashboard';

const AgentDashboard = () => {
  const { user, loading: authLoading, isEmailVerified } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { isImpersonating, impersonatedRole, getDemoUserId } = useRoleImpersonation();
  const emailVerified = isEmailVerified();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get('tab');
    const validTabs = ['list', 'analytics', 'reminders', 'services', 'plan', 'form'];
    return tabParam && validTabs.includes(tabParam) ? tabParam : 'list';
  });
  
  // Sincronizar activeTab cuando cambia la URL
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const validTabs = ['list', 'analytics', 'reminders', 'services', 'plan', 'form'];
    if (tabParam && validTabs.includes(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);
  
  const [editingProperty, setEditingProperty] = useState<any>(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [featuredCount, setFeaturedCount] = useState(0);
  const [reactivating, setReactivating] = useState(false);
  
  
  // Si está simulando rol agent, usar agent demo; si no, usar user real
  const effectiveAgentId = (isImpersonating && impersonatedRole === 'agent') 
    ? getDemoUserId() 
    : user?.id;

  // Fetch properties con React Query
  const { data: allProperties = [], isLoading: propertiesLoading } = useAgentProperties(effectiveAgentId);
  
  // Fetch unread messages count
  const { data: unreadMessagesCount = 0 } = useQuery({
    queryKey: ['unread-messages', effectiveAgentId],
    queryFn: async () => {
      if (!effectiveAgentId) return 0;
      const { data, error } = await supabase
        .from('conversation_participants')
        .select('unread_count')
        .eq('user_id', effectiveAgentId);
      
      if (error) {
        console.error('Error fetching unread messages:', error);
        return 0;
      }
      
      return data?.reduce((sum, item) => sum + (item.unread_count || 0), 0) || 0;
    },
    enabled: !!effectiveAgentId,
    refetchInterval: 30000,
  });

  // Fetch total views for agent's properties
  const { data: totalViewsData = 0 } = useQuery({
    queryKey: ['agent-total-views', effectiveAgentId],
    queryFn: async () => {
      if (!effectiveAgentId) return 0;
      
      // Get all property IDs for this agent
      const { data: propertyIds, error: propError } = await supabase
        .from('properties')
        .select('id')
        .eq('agent_id', effectiveAgentId);
      
      if (propError || !propertyIds?.length) return 0;
      
      // Count total views for those properties
      const { count, error: viewsError } = await supabase
        .from('property_views')
        .select('*', { count: 'exact', head: true })
        .in('property_id', propertyIds.map(p => p.id));
      
      if (viewsError) {
        console.error('Error fetching views:', viewsError);
        return 0;
      }
      
      return count || 0;
    },
    enabled: !!effectiveAgentId,
    staleTime: 60 * 1000, // Cache for 1 minute
  });
  
  // Calcular counts desde los datos
  const activePropertiesCount = useMemo(() => {
    return allProperties.filter(p => p.status === 'activa').length;
  }, [allProperties]);

  // Contar propiedades por estado para badges
  const propertyCounts = useMemo(() => {
    const pending = allProperties.filter(p => p.status === 'pendiente_aprobacion').length;
    const reminders = allProperties.filter(p => {
      if (!p.expires_at) return false;
      const daysUntilExpiry = Math.ceil((new Date(p.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
    }).length;
    return { pending, reminders, total: allProperties.length };
  }, [allProperties]);

  // Determinar si el usuario puede comprar upsells (solo con suscripción activa)
  const canPurchaseUpsells = subscriptionInfo?.status === 'active';

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    if (user) {
      checkAgentStatus();
    }
  }, [user, authLoading, navigate, isImpersonating, impersonatedRole]);

  const checkAgentStatus = async () => {
    const localImpersonated = localStorage.getItem('kentra_impersonated_role');
    const isLocalSimulatingAgent = localImpersonated === 'agent';
    const DEMO_AGENT_ID = '00000000-0000-0000-0000-000000000001';

    if (isLocalSimulatingAgent) {
      const demoId = DEMO_AGENT_ID;
      setUserRole('agent');

      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', demoId)
          .single();
        setProfile(profileData || { name: 'Demo Agent Kentra', id: demoId });

        const { data: subInfo } = await supabase.rpc('get_user_subscription_info', { user_uuid: demoId });
        if (subInfo && subInfo.length > 0) setSubscriptionInfo(subInfo[0]);

        await fetchFeaturedCount();
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!effectiveAgentId) {
      setLoading(false);
      return;
    }

    try {
      if (isImpersonating && impersonatedRole === 'agent') {
        setUserRole('agent');
        
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', effectiveAgentId)
          .single();
        
        setProfile(profileData || { name: 'Demo Agent Kentra', id: effectiveAgentId });

        const { data: subInfo } = await supabase.rpc('get_user_subscription_info', {
          user_uuid: effectiveAgentId,
        });

        if (subInfo && subInfo.length > 0) {
          setSubscriptionInfo(subInfo[0]);
        }

        await fetchFeaturedCount();
        
        setLoading(false);
        return;
      }

      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id)
        .in('role', ['agent', 'agency'])
        .single();

      if (roleError || !roleData) {
        toast({
          title: 'Acceso denegado',
          description: 'Solo los agentes pueden acceder a esta página',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      if (roleData.role === 'agency') {
        navigate('/panel-inmobiliaria');
        return;
      }

      setUserRole(roleData.role);

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (profileError) throw profileError;

      setProfile(profileData);

      const { data: subInfo, error: subError } = await supabase.rpc('get_user_subscription_info', {
        user_uuid: user?.id,
      });

      if (!subError && subInfo && subInfo.length > 0) {
        setSubscriptionInfo(subInfo[0]);
        
        if (subInfo[0].status === 'canceled') {
          try {
            await supabase.functions.invoke('sync-subscription-status');
            const { data: updatedSubInfo } = await supabase.rpc('get_user_subscription_info', {
              user_uuid: user?.id,
            });
            if (updatedSubInfo && updatedSubInfo.length > 0) {
              setSubscriptionInfo(updatedSubInfo[0]);
            }
          } catch (syncError) {
            console.error('Error sincronizando estado de suscripción:', syncError);
          }
        }
      }

      await fetchFeaturedCount();
    } catch (error) {
      console.error('Error checking agent status:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const fetchFeaturedCount = async () => {
    if (!effectiveAgentId) return;

    try {
      const { count: featuredCountData } = await supabase
        .from('featured_properties')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', effectiveAgentId)
        .eq('status', 'active')
        .gt('end_date', new Date().toISOString());

      setFeaturedCount(featuredCountData || 0);
    } catch (error) {
      console.error('Error fetching featured count:', error);
    }
  };

  const handlePropertyCreated = () => {
    setActiveTab('list');
    setEditingProperty(null);
    toast({
      title: 'Éxito',
      description: 'Propiedad creada correctamente',
    });
  };

  const handlePropertyUpdated = () => {
    setActiveTab('list');
    setEditingProperty(null);
    toast({
      title: 'Éxito',
      description: 'Propiedad actualizada correctamente',
    });
  };

  const handleEditProperty = (property: any) => {
    setEditingProperty(property);
    setActiveTab('form');
  };

  const handleReactivateSubscription = async () => {
    setReactivating(true);
    try {
      const { data, error } = await supabase.functions.invoke('reactivate-subscription');
      
      if (error) throw error;
      
      if (!data.success) {
        if (data.code === 'SUBSCRIPTION_FULLY_CANCELED') {
          toast({
            title: "No se puede reactivar",
            description: data.error || "Esta suscripción ya está cancelada. Debes contratar un nuevo plan desde las páginas de precios.",
            variant: "destructive",
          });
        } else if (data.code === 'CANNOT_REACTIVATE') {
          toast({
            title: "No se puede reactivar",
            description: data.error || "Esta suscripción no puede ser reactivada.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error al reactivar",
            description: data.error || "No se pudo reactivar tu suscripción.",
            variant: "destructive",
          });
        }
        return;
      }
      
      toast({
        title: "¡Suscripción reactivada!",
        description: data.message || "Tu suscripción ha sido reactivada exitosamente.",
      });
      
      if (effectiveAgentId) {
        const { data: subInfo } = await supabase.rpc('get_user_subscription_info', { 
          user_uuid: effectiveAgentId 
        });
        if (subInfo && subInfo.length > 0) {
          setSubscriptionInfo(subInfo[0]);
        }
      }
    } catch (error: any) {
      console.error('Error reactivating subscription:', error);
      toast({
        title: "Error al reactivar",
        description: error.message || "No se pudo reactivar tu suscripción. Por favor intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setReactivating(false);
    }
  };

  const handleGoToPricing = () => {
    const route = userRole === 'agency'
      ? '/pricing-inmobiliaria'
      : userRole === 'developer'
      ? '/pricing-desarrolladora'
      : '/pricing-agente';
    navigate(route);
  };

  const handleNewProperty = async () => {
    // Usar effectiveAgentId para que funcione en modo impersonación
    if (!effectiveAgentId) {
      toast({
        title: 'Error',
        description: 'No se pudo identificar al usuario',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data: validation, error } = await supabase.rpc('can_create_property', {
        user_uuid: effectiveAgentId,
      });

      if (error) throw error;

      if (!validation || !validation[0]?.can_create) {
        const reason = validation?.[0]?.reason || 'No puedes publicar más propiedades';
        
        let upgradeMessage = '';
        if (subscriptionInfo) {
          const planName = subscriptionInfo.plan_name;
          if (planName === 'basico') {
            upgradeMessage = ' Mejora a Pro para 10 propiedades.';
          } else if (planName === 'pro') {
            upgradeMessage = ' Mejora a Elite para 20 propiedades.';
          }
        }

        toast({
          title: 'Límite alcanzado',
          description: `${reason}${upgradeMessage}`,
          variant: 'destructive',
          action: subscriptionInfo ? (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate(userRole === 'agency' ? '/pricing-inmobiliaria' : '/pricing-agente')}
            >
              Ver Planes
            </Button>
          ) : undefined,
        });
        return;
      }

      setEditingProperty(null);
      setActiveTab('form');
      
      // Scroll automático al formulario para feedback visual
      setTimeout(() => {
        document.getElementById('dashboard-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (error) {
      console.error('Error validating property creation:', error);
      toast({
        title: 'Error',
        description: 'No se pudo validar el límite de propiedades',
        variant: 'destructive',
      });
    }
  };

  const handleUpsellPurchase = async (upsellId: string, quantity: number = 1) => {
    if (isImpersonating) {
      toast({
        title: 'Acción no disponible',
        description: 'No puedes comprar upsells en modo simulación',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      
      const { data: upsell, error: upsellError } = await supabase
        .from('upsells')
        .select('*')
        .eq('id', upsellId)
        .single();

      if (upsellError || !upsell) throw new Error('Upsell no encontrado');

      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          upsellOnly: true,
          upsells: [{ id: upsellId, quantity }],
        },
      });

      if (error) throw error;

      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('No se recibió URL de checkout');
      }
    } catch (error: any) {
      console.error('Error comprando upsell:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo iniciar el proceso de compra',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
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

  if (!profile) {
    return null;
  }

  // Tab configuration with icons and badges - Orden optimizado: Properties First
  const tabs = [
    { 
      value: 'list', 
      label: 'Propiedades', 
      icon: Home,
      badge: propertyCounts.total > 0 ? propertyCounts.total : null,
    },
    { 
      value: 'form', 
      label: editingProperty ? 'Editar' : 'Nueva',
      icon: FileEdit,
      badge: null,
      disabled: !emailVerified && !editingProperty,
    },
    { 
      value: 'analytics', 
      label: 'Analíticas', 
      icon: BarChart3,
      badge: null,
    },
    { 
      value: 'reminders', 
      label: 'Recordatorios', 
      icon: Bell,
      badge: propertyCounts.reminders > 0 ? propertyCounts.reminders : null,
      badgeVariant: 'warning' as const,
    },
    // Solo mostrar "Servicios" si tiene suscripción activa
    ...(canPurchaseUpsells ? [{ 
      value: 'services', 
      label: 'Servicios', 
      icon: Sparkles,
      badge: null,
    }] : []),
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
            { label: 'Panel de Agente', href: '', active: true }
          ]} 
          className="mb-4" 
        />

        {/* Compact Header - Properties First Layout with Premium Look */}
        <CompactDashboardHeader
          profileName={profile?.name || 'Agente'}
          planName={subscriptionInfo?.name}
          planDisplayName={subscriptionInfo?.display_name}
          activePropertiesCount={activePropertiesCount}
          totalViews={totalViewsData}
          pendingReminders={propertyCounts.reminders}
          onNewProperty={handleNewProperty}
          subscriptionInfo={{
            status: subscriptionInfo?.status,
            planName: subscriptionInfo?.name,
            currentPeriodEnd: subscriptionInfo?.current_period_end,
            maxProperties: subscriptionInfo?.properties_limit || 5,
            featuredPerMonth: subscriptionInfo?.featured_limit || 1,
          }}
          featuredCount={featuredCount}
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
                Tu suscripción ha expirado. Contrata un nuevo plan para publicar.
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
                        disabled={tab.disabled}
                        className={`
                          relative flex-1 min-w-[90px] flex items-center justify-center gap-2 
                          px-4 py-3 rounded-xl font-medium text-sm
                          transition-all duration-200
                          ${isActive 
                            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' 
                            : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border'
                          }
                          ${tab.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                          data-[state=active]:bg-primary data-[state=active]:text-primary-foreground
                        `}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="hidden sm:inline">{tab.label}</span>
                        {tab.badge && (
                          <Badge 
                            variant={tab.badgeVariant === 'warning' ? 'destructive' : 'secondary'}
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

              <TabsContent value="list" className="mt-0">
                {propertiesLoading ? (
                  <div className="space-y-4">
                    <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-64 bg-muted animate-pulse rounded-xl" />
                      ))}
                    </div>
                  </div>
                ) : (
                  <AgentPropertyList 
                    onEdit={handleEditProperty} 
                    subscriptionInfo={subscriptionInfo}
                    onCreateProperty={handleNewProperty}
                  />
                )}
              </TabsContent>

              <TabsContent value="analytics" className="mt-0">
                <AgentAnalytics agentId={effectiveAgentId || ''} />
              </TabsContent>

              <TabsContent value="reminders" className="mt-0">
                <PropertyExpiryReminders agentId={effectiveAgentId || ''} />
              </TabsContent>

              <TabsContent value="services" className="mt-0">
                <AgentUpsells onPurchase={handleUpsellPurchase} />
              </TabsContent>

              <TabsContent value="plan" className="mt-0 space-y-6">
                {/* Plan Overview Grid */}
                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="lg:col-span-1">
                    <PremiumSubscriptionCard
                      subscriptionInfo={subscriptionInfo}
                      userRole={userRole}
                      activePropertiesCount={activePropertiesCount}
                      featuredCount={featuredCount}
                      onManage={() => {}}
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <PremiumMetricsCards
                      subscriptionInfo={subscriptionInfo}
                      activePropertiesCount={activePropertiesCount}
                      featuredCount={featuredCount}
                    />
                    {subscriptionInfo && canPurchaseUpsells && (
                      <QuickUpsells 
                        subscriptionInfo={subscriptionInfo}
                        activePropertiesCount={activePropertiesCount}
                        onPurchase={handleUpsellPurchase}
                        onViewAll={() => setActiveTab('services')}
                      />
                    )}
                  </div>
                </div>
                {/* Subscription Management */}
                <SubscriptionManagement userId={effectiveAgentId || ''} />
              </TabsContent>

              <TabsContent value="form" className="mt-0">
                <SubscriptionGate 
                  type="property" 
                  userRole={userRole}
                  message="Necesitas una suscripción activa para publicar propiedades."
                >
                  <PropertyFormWizard
                    property={editingProperty}
                    onSuccess={editingProperty ? handlePropertyUpdated : handlePropertyCreated}
                    onCancel={() => {
                      setActiveTab('list');
                      setEditingProperty(null);
                    }}
                  />
                </SubscriptionGate>
              </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AgentDashboard;
