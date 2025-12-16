import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useRoleImpersonation } from '@/hooks/useRoleImpersonation';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Building2, Users, CreditCard, BarChart3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DynamicBreadcrumbs } from '@/components/DynamicBreadcrumbs';
import { PlanStatusCard } from '@/components/PlanStatusCard';
import { SubscriptionManagement } from '@/components/SubscriptionManagement';
import { EmailVerificationRequired } from '@/components/EmailVerificationRequired';
import { DeveloperProjectManagement } from '@/components/DeveloperProjectManagement';
import { DeveloperTeamManagement } from '@/components/DeveloperTeamManagement';
import { DeveloperAnalytics } from '@/components/DeveloperAnalytics';

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
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'projects');
  
  // Si está simulando rol developer, usar owner/developer demo
  const effectiveOwnerId = (isImpersonating && impersonatedRole === 'developer') 
    ? getDemoUserId() 
    : user?.id;
  const effectiveDeveloperId = (isImpersonating && impersonatedRole === 'developer')
    ? getDemoDeveloperId()
    : developer?.id;

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

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!developer) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
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

        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-2">
            Panel de Desarrolladora
          </h1>
          <p className="text-muted-foreground">
            {developer.name} - Gestión de proyectos y equipo
          </p>
        </div>

        {/* Plan Status Card */}
        <div className="mb-6">
          <PlanStatusCard subscriptionInfo={subscriptionInfo} userRole="developer" />
        </div>

        {/* Email Verification Banner */}
        {!emailVerified && (
          <div className="mb-6">
            <EmailVerificationRequired />
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>
              {activeTab === 'projects' && 'Proyectos de Desarrollo'}
              {activeTab === 'team' && 'Gestión de Equipo'}
              {activeTab === 'analytics' && 'Reportes y Analíticas'}
              {activeTab === 'subscription' && 'Gestión de Suscripción'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="projects" className="gap-2">
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Proyectos</span>
                </TabsTrigger>
                <TabsTrigger value="team" className="gap-2">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Equipo</span>
                </TabsTrigger>
                <TabsTrigger value="analytics" className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Reportes</span>
                </TabsTrigger>
                <TabsTrigger value="subscription" className="gap-2">
                  <CreditCard className="h-4 w-4" />
                  <span className="hidden sm:inline">Suscripción</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="projects" className="mt-6">
                <DeveloperProjectManagement 
                  developerId={effectiveDeveloperId || developer?.id || ''} 
                  subscriptionInfo={subscriptionInfo}
                />
              </TabsContent>

              <TabsContent value="team" className="mt-6">
                <DeveloperTeamManagement 
                  developerId={effectiveDeveloperId || developer?.id || ''} 
                  subscriptionInfo={subscriptionInfo}
                />
              </TabsContent>

              <TabsContent value="analytics" className="mt-6">
                <DeveloperAnalytics developerId={effectiveDeveloperId || developer?.id || ''} />
              </TabsContent>

              <TabsContent value="subscription" className="mt-6">
                <SubscriptionManagement userId={effectiveOwnerId || ''} userRole="developer" />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default DeveloperDashboard;
