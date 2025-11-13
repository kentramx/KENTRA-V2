import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useAgentProperties } from '@/hooks/useAgentProperties';
import { useRoleImpersonation } from '@/hooks/useRoleImpersonation';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, RefreshCcw, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import PropertyForm from '@/components/PropertyForm';
import AgentPropertyList from '@/components/AgentPropertyList';
import { AgentAnalytics } from '@/components/AgentAnalytics';
import { DynamicBreadcrumbs } from '@/components/DynamicBreadcrumbs';
import { PlanStatusCard } from '@/components/PlanStatusCard';
import { SubscriptionManagement } from '@/components/SubscriptionManagement';
import { PropertyExpiryReminders } from '@/components/PropertyExpiryReminders';
import { PlanMetricsCards } from '@/components/PlanMetricsCards';
import { EmailVerificationRequired } from '@/components/EmailVerificationRequired';
import { QuickUpsells } from '@/components/QuickUpsells';
import { AgentUpsells } from '@/components/AgentUpsells';
import { SubscriptionStatusBadge } from '@/components/SubscriptionStatusBadge';

const AgentDashboard = () => {
  const { user, loading: authLoading, isEmailVerified } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { isImpersonating, impersonatedRole, getDemoUserId } = useRoleImpersonation();
  const emailVerified = isEmailVerified();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(
    searchParams.get('tab') === 'form' ? 'form' : 'list'
  );
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
  const { data: allProperties = [] } = useAgentProperties(effectiveAgentId);
  
  // Calcular counts desde los datos
  const activePropertiesCount = useMemo(() => {
    return allProperties.filter(p => p.status === 'activa').length;
  }, [allProperties]);

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
    // Chequeo sincronizado inmediato por localStorage para evitar carreras
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
      return; // salir siempre en simulación
    }

    if (!effectiveAgentId) {
      setLoading(false);
      return;
    }

    try {
      // Si está simulando, cargar datos demo
      if (isImpersonating && impersonatedRole === 'agent') {
        setUserRole('agent');
        
        // Cargar perfil demo
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', effectiveAgentId)
          .single();
        
        setProfile(profileData || { name: 'Demo Agent Kentra', id: effectiveAgentId });

        // Cargar suscripción demo
        const { data: subInfo } = await supabase.rpc('get_user_subscription_info', {
          user_uuid: effectiveAgentId,
        });

        if (subInfo && subInfo.length > 0) {
          setSubscriptionInfo(subInfo[0]);
        }

        // Get featured properties count
        await fetchFeaturedCount();
        
        setLoading(false);
        return;
      }

      // Check user role from user_roles table
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

      // Si es agencia, redirigir al dashboard de inmobiliaria
      if (roleData.role === 'agency') {
        navigate('/panel-inmobiliaria');
        return;
      }

      setUserRole(roleData.role);

      // Get profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (profileError) throw profileError;

      setProfile(profileData);

      // Get subscription info
      const { data: subInfo, error: subError } = await supabase.rpc('get_user_subscription_info', {
        user_uuid: user?.id,
      });

      if (!subError && subInfo && subInfo.length > 0) {
        setSubscriptionInfo(subInfo[0]);
      }

      // Get featured properties count
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
      
      // Check if the operation was successful
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
      
      // Recargar información de suscripción
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

  const handleNewProperty = async () => {
    if (!user) return;

    try {
      // Validar si puede crear propiedades
      const { data: validation, error } = await supabase.rpc('can_create_property', {
        user_uuid: user.id,
      });

      if (error) throw error;

      if (!validation || !validation[0]?.can_create) {
        const reason = validation?.[0]?.reason || 'No puedes publicar más propiedades';
        const currentCount = validation?.[0]?.current_count || 0;
        const maxAllowed = validation?.[0]?.max_allowed || 0;
        
        // Mensaje personalizado según el plan
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

      // Puede crear - mostrar formulario
      setEditingProperty(null);
      setActiveTab('form');
    } catch (error) {
      console.error('Error validating property creation:', error);
      toast({
        title: 'Error',
        description: 'No se pudo validar el límite de propiedades',
        variant: 'destructive',
      });
    }
  };

  const handleUpsellPurchase = async (upsellId: string) => {
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
      
      // Obtener detalles del upsell
      const { data: upsell, error: upsellError } = await supabase
        .from('upsells')
        .select('*')
        .eq('id', upsellId)
        .single();

      if (upsellError || !upsell) throw new Error('Upsell no encontrado');

      // Llamar a create-checkout-session SOLO con el upsell
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          upsellOnly: true,
          upsells: [{
            id: upsell.id,
            stripePriceId: upsell.stripe_price_id,
            name: upsell.name,
            price: upsell.price,
            isRecurring: upsell.is_recurring,
          }],
          successUrl: `${window.location.origin}/payment-success?type=upsell`,
          cancelUrl: `${window.location.origin}/panel-agente?tab=services`,
        },
      });

      if (error) throw error;

      // Redirigir a Stripe Checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (error) {
      console.error('Error comprando upsell:', error);
      toast({
        title: 'Error',
        description: 'No se pudo iniciar el proceso de compra',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        {/* Breadcrumbs */}
        <DynamicBreadcrumbs 
          items={[
            { label: 'Inicio', href: '/', active: false },
            { label: 'Panel de Agente', href: '', active: true }
          ]} 
          className="mb-4" 
        />

        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">
                Panel de {userRole === 'agency' ? 'Inmobiliaria' : 'Agente'}
              </h1>
              <p className="text-muted-foreground">
                Gestiona tus propiedades en venta o renta
              </p>
            </div>
            <div className="flex-shrink-0">
              <SubscriptionStatusBadge 
                status={subscriptionInfo?.status || null}
                currentPeriodEnd={subscriptionInfo?.current_period_end}
              />
            </div>
          </div>
        </div>

        {/* Alerta prominente de suscripción cancelada */}
        {subscriptionInfo?.status === 'canceled' && subscriptionInfo?.cancel_at_period_end && (
          <Alert className="mb-6 border-destructive/50 bg-destructive/10">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <AlertTitle className="text-lg font-semibold text-destructive">
              Suscripción Cancelada
            </AlertTitle>
            <AlertDescription className="mt-2 flex items-center justify-between gap-4 flex-wrap">
              <div className="text-sm text-muted-foreground flex-1 min-w-[300px]">
                Tu suscripción se cancelará el{' '}
                <span className="font-medium text-foreground">
                  {new Date(subscriptionInfo.current_period_end).toLocaleDateString('es-MX', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
                . Después de esa fecha perderás acceso a tus propiedades y servicios.
              </div>
              <Button
                onClick={handleReactivateSubscription}
                disabled={reactivating}
                size="lg"
                className="bg-primary hover:bg-primary/90 shadow-lg"
              >
                {reactivating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reactivando...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Reactivar Suscripción
                  </>
                )}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Plan Status Card */}
        <div className="mb-6">
          <PlanStatusCard subscriptionInfo={subscriptionInfo} userRole={userRole} />
        </div>

        {/* Plan Metrics Cards */}
        <PlanMetricsCards
          subscriptionInfo={subscriptionInfo}
          activePropertiesCount={activePropertiesCount}
          featuredCount={featuredCount}
        />

        {/* Quick Upsells Section */}
        {subscriptionInfo && (
          <div className="mb-6">
            <QuickUpsells 
              subscriptionInfo={subscriptionInfo}
              activePropertiesCount={activePropertiesCount}
              onPurchase={handleUpsellPurchase}
              onViewAll={() => setActiveTab('services')}
            />
          </div>
        )}

        {/* Email Verification Banner */}
        {!emailVerified && (
          <div className="mb-6">
            <EmailVerificationRequired />
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {activeTab === 'analytics' ? 'Panel de Analíticas' : 'Mis Propiedades'}
              </CardTitle>
              {activeTab === 'list' && (
                <Button onClick={handleNewProperty}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva Propiedad
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="list">Mis Propiedades</TabsTrigger>
                <TabsTrigger value="analytics">Analíticas</TabsTrigger>
                <TabsTrigger value="reminders">Recordatorios</TabsTrigger>
                <TabsTrigger value="services">Servicios</TabsTrigger>
                <TabsTrigger value="subscription">Suscripción</TabsTrigger>
                <TabsTrigger 
                  value="form" 
                  disabled={!emailVerified && !editingProperty}
                >
                  {editingProperty ? 'Editar' : 'Nueva'} Propiedad
                </TabsTrigger>
              </TabsList>

              <TabsContent value="list" className="mt-6">
                <AgentPropertyList onEdit={handleEditProperty} subscriptionInfo={subscriptionInfo} />
              </TabsContent>

              <TabsContent value="analytics" className="mt-6">
                <AgentAnalytics agentId={effectiveAgentId || ''} />
              </TabsContent>

              <TabsContent value="reminders" className="mt-6">
                <PropertyExpiryReminders agentId={effectiveAgentId || ''} />
              </TabsContent>

              <TabsContent value="services" className="mt-6">
                <AgentUpsells onPurchase={handleUpsellPurchase} />
              </TabsContent>

              <TabsContent value="subscription" className="mt-6">
                <SubscriptionManagement userId={effectiveAgentId || ''} />
              </TabsContent>

              <TabsContent value="form" className="mt-6">
                <PropertyForm
                  property={editingProperty}
                  onSuccess={editingProperty ? handlePropertyUpdated : handlePropertyCreated}
                  onCancel={() => {
                    setActiveTab('list');
                    setEditingProperty(null);
                  }}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AgentDashboard;
