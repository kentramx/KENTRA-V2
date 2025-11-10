import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PropertyForm from '@/components/PropertyForm';
import AgentPropertyList from '@/components/AgentPropertyList';
import { AgentAnalytics } from '@/components/AgentAnalytics';
import { DynamicBreadcrumbs } from '@/components/DynamicBreadcrumbs';
import { PlanStatusCard } from '@/components/PlanStatusCard';
import { SubscriptionManagement } from '@/components/SubscriptionManagement';
import { PropertyExpiryReminders } from '@/components/PropertyExpiryReminders';

const AgentDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list');
  const [editingProperty, setEditingProperty] = useState<any>(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    if (user) {
      checkAgentStatus();
    }
  }, [user, authLoading, navigate]);

  const checkAgentStatus = async () => {
    try {
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
    } catch (error) {
      console.error('Error checking agent status:', error);
      navigate('/');
    } finally {
      setLoading(false);
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
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Panel de {userRole === 'agency' ? 'Inmobiliaria' : 'Agente'}
          </h1>
          <p className="text-muted-foreground">
            Gestiona tus propiedades en venta o renta
          </p>
        </div>

        {/* Plan Status Card */}
        <div className="mb-6">
          <PlanStatusCard subscriptionInfo={subscriptionInfo} userRole={userRole} />
        </div>

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
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="list">Mis Propiedades</TabsTrigger>
                <TabsTrigger value="analytics">Analíticas</TabsTrigger>
                <TabsTrigger value="reminders">Recordatorios</TabsTrigger>
                <TabsTrigger value="subscription">Suscripción</TabsTrigger>
                <TabsTrigger value="form">
                  {editingProperty ? 'Editar' : 'Nueva'} Propiedad
                </TabsTrigger>
              </TabsList>

              <TabsContent value="list" className="mt-6">
                <AgentPropertyList onEdit={handleEditProperty} subscriptionInfo={subscriptionInfo} />
              </TabsContent>

              <TabsContent value="analytics" className="mt-6">
                <AgentAnalytics agentId={user?.id || ''} />
              </TabsContent>

              <TabsContent value="reminders" className="mt-6">
                <PropertyExpiryReminders agentId={user?.id || ''} />
              </TabsContent>

              <TabsContent value="subscription" className="mt-6">
                <SubscriptionManagement userId={user?.id || ''} />
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
