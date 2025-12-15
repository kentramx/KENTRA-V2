import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useRoleImpersonation } from '@/hooks/useRoleImpersonation';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Building2, CreditCard, FileText, BarChart3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DynamicBreadcrumbs } from '@/components/DynamicBreadcrumbs';
import { PlanStatusCard } from '@/components/PlanStatusCard';
import { SubscriptionManagement } from '@/components/SubscriptionManagement';
import { EmailVerificationRequired } from '@/components/EmailVerificationRequired';
import { SubscriptionWidget } from '@/components/subscription/SubscriptionWidget';

const DeveloperDashboard = () => {
  const { user, loading: authLoading, isEmailVerified } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { isImpersonating, impersonatedRole, getDemoUserId } = useRoleImpersonation();
  const emailVerified = isEmailVerified();
  const [loading, setLoading] = useState(true);
  const [developerInfo, setDeveloperInfo] = useState<any>(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(
    searchParams.get('tab') || 'projects'
  );
  
  // Si está simulando rol developer, usar user demo; si no, usar user real
  const effectiveUserId = (isImpersonating && impersonatedRole === 'developer') 
    ? getDemoUserId() 
    : user?.id;

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
    // Chequeo sincronizado inmediato por localStorage para evitar carreras
    const localImpersonated = localStorage.getItem('kentra_impersonated_role');
    const isLocalSimulatingDeveloper = localImpersonated === 'developer';
    const DEMO_DEVELOPER_ID = '00000000-0000-0000-0000-000000000020';

    if (isLocalSimulatingDeveloper) {
      try {
        const userId = DEMO_DEVELOPER_ID;

        setDeveloperInfo({ 
          name: 'Desarrolladora Demo', 
          id: userId,
          company_name: 'Kentra Desarrollos Demo'
        });

        const { data: subInfo } = await supabase.rpc('get_user_subscription_info', { user_uuid: userId });
        if (subInfo && subInfo.length > 0) setSubscriptionInfo(subInfo[0]);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!effectiveUserId) {
      setLoading(false);
      return;
    }

    try {
      // Si está simulando (vía hook), cargar datos demo
      if (isImpersonating && impersonatedRole === 'developer') {
        const userId = getDemoUserId() || DEMO_DEVELOPER_ID;

        setDeveloperInfo({ 
          name: 'Desarrolladora Demo', 
          id: userId,
          company_name: 'Kentra Desarrollos Demo'
        });

        const { data: subInfo } = await supabase.rpc('get_user_subscription_info', { user_uuid: userId });
        if (subInfo && subInfo.length > 0) setSubscriptionInfo(subInfo[0]);
        
        setLoading(false);
        return;
      }

      // Verificar rol de desarrolladora
      // Note: 'developer' role may need to be added to app_role enum in database
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id)
        .eq('role', 'developer' as any)
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

      // Obtener datos del perfil
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (profileError) throw profileError;

      setDeveloperInfo({
        ...profileData,
        company_name: profileData?.name || 'Mi Desarrolladora'
      });

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

  if (!developerInfo) {
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
            { label: 'Panel de Desarrolladora', href: '', active: true }
          ]} 
          className="mb-4" 
        />

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Panel de Desarrolladora
          </h1>
          <p className="text-muted-foreground">
            {developerInfo.company_name} - Gestión de proyectos y desarrollos
          </p>
        </div>

        {/* Plan Status Card */}
        <div className="mb-6">
          <PlanStatusCard subscriptionInfo={subscriptionInfo} userRole="developer" />
        </div>

        {/* Subscription Widget */}
        <div className="mb-6">
          <SubscriptionWidget userRole="developer" />
        </div>

        {/* Email Verification Banner */}
        {!emailVerified && (
          <div className="mb-6">
            <EmailVerificationRequired />
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {activeTab === 'projects' && <><Building2 className="h-5 w-5" /> Proyectos</>}
              {activeTab === 'subscription' && <><CreditCard className="h-5 w-5" /> Gestión de Suscripción</>}
              {activeTab === 'invoices' && <><FileText className="h-5 w-5" /> Facturas</>}
              {activeTab === 'analytics' && <><BarChart3 className="h-5 w-5" /> Reportes</>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="projects" className="gap-2">
                  <Building2 className="h-4 w-4" />
                  Proyectos
                </TabsTrigger>
                <TabsTrigger value="subscription" className="gap-2">
                  <CreditCard className="h-4 w-4" />
                  Suscripción
                </TabsTrigger>
                <TabsTrigger value="invoices" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Facturas
                </TabsTrigger>
                <TabsTrigger value="analytics" className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Reportes
                </TabsTrigger>
              </TabsList>

              <TabsContent value="projects" className="mt-6">
                <div className="text-center py-12">
                  <Building2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Gestión de Proyectos</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Aquí podrás gestionar tus desarrollos inmobiliarios, 
                    agregar nuevos proyectos y dar seguimiento a cada uno.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="subscription" className="mt-6">
                <SubscriptionManagement userId={effectiveUserId || ''} userRole="developer" />
              </TabsContent>

              <TabsContent value="invoices" className="mt-6">
                <div className="text-center py-12">
                  <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Historial de Facturas</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Consulta y descarga tus facturas desde la pestaña de Suscripción.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="analytics" className="mt-6">
                <div className="text-center py-12">
                  <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Reportes y Analíticas</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Próximamente podrás ver estadísticas detalladas de tus proyectos,
                    leads generados y rendimiento general.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default DeveloperDashboard;