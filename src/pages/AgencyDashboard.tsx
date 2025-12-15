import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useRoleImpersonation } from '@/hooks/useRoleImpersonation';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DynamicBreadcrumbs } from '@/components/DynamicBreadcrumbs';
import { PlanStatusCard } from '@/components/PlanStatusCard';
import { AgencyTeamManagement } from '@/components/AgencyTeamManagement';
import { AgencyInventory } from '@/components/AgencyInventory';
import { AgencyAnalytics } from '@/components/AgencyAnalytics';
import { PropertyAssignmentHistory } from '@/components/PropertyAssignmentHistory';
import { SubscriptionManagement } from '@/components/SubscriptionManagement';
import { EmailVerificationRequired } from '@/components/EmailVerificationRequired';

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
  const [activeTab, setActiveTab] = useState(
    searchParams.get('tab') === 'form' ? 'inventory' : 'inventory'
  );
  
  // Si está simulando rol agency, usar owner/agency demo; si no, usar user real
  const effectiveOwnerId = (isImpersonating && impersonatedRole === 'agency') 
    ? getDemoUserId() 
    : user?.id;
  const effectiveAgencyId = (isImpersonating && impersonatedRole === 'agency')
    ? getDemoAgencyId()
    : agency?.id;

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

        const { data: subInfo } = await supabase.rpc('get_user_subscription_info', { user_uuid: ownerId });
        if (subInfo && subInfo.length > 0) setSubscriptionInfo(subInfo[0]);
      } finally {
        setLoading(false);
      }
      return; // salir siempre en simulación
    }

    if (!effectiveOwnerId) {
      setLoading(false);
      return;
    }

    try {
      // Si está simulando (vía hook), cargar datos demo y terminar aquí
      if (isImpersonating && impersonatedRole === 'agency') {
        const ownerId = getDemoUserId() || DEMO_OWNER_ID;
        const agencyId = getDemoAgencyId() || DEMO_AGENCY_ID;

        const { data: agencyData } = await supabase
          .from('agencies')
          .select('*')
          .eq('owner_id', ownerId)
          .single();
        
        setAgency(agencyData || { name: 'Kentra Inmobiliaria Demo', owner_id: ownerId, id: agencyId });

        const { data: subInfo } = await supabase.rpc('get_user_subscription_info', { user_uuid: ownerId });
        if (subInfo && subInfo.length > 0) setSubscriptionInfo(subInfo[0]);
        
        setLoading(false);
        return; // IMPORTANTE: Salir aquí para no verificar rol real
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
      const { data: subInfo, error: subError } = await supabase.rpc('get_user_subscription_info', {
        user_uuid: user?.id,
      });

      if (!subError && subInfo && subInfo.length > 0) {
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

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!agency) {
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
            { label: 'Panel de Inmobiliaria', href: '', active: true }
          ]} 
          className="mb-4" 
        />

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Panel de Inmobiliaria
          </h1>
          <p className="text-muted-foreground">
            {agency.name} - Gestión de equipo e inventario
          </p>
        </div>

        {/* Plan Status Card */}
        <div className="mb-6">
          <PlanStatusCard subscriptionInfo={subscriptionInfo} userRole="agency" />
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
              {activeTab === 'team' && 'Gestión de Equipo'}
              {activeTab === 'inventory' && 'Inventario Compartido'}
              {activeTab === 'analytics' && 'Reportes Consolidados'}
              {activeTab === 'history' && 'Historial de Asignaciones'}
              {activeTab === 'subscription' && 'Gestión de Suscripción'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="inventory">Inventario</TabsTrigger>
                <TabsTrigger value="team">Equipo</TabsTrigger>
                <TabsTrigger value="analytics">Reportes</TabsTrigger>
                <TabsTrigger value="history">Historial</TabsTrigger>
                <TabsTrigger value="subscription">Suscripción</TabsTrigger>
              </TabsList>

              <TabsContent value="inventory" className="mt-6">
                <AgencyInventory 
                  agencyId={effectiveAgencyId || agency?.id || ''} 
                  subscriptionInfo={subscriptionInfo}
                />
              </TabsContent>

              <TabsContent value="team" className="mt-6">
                <AgencyTeamManagement 
                  agencyId={effectiveAgencyId || agency?.id || ''} 
                  subscriptionInfo={subscriptionInfo}
                />
              </TabsContent>

              <TabsContent value="analytics" className="mt-6">
                <AgencyAnalytics agencyId={effectiveAgencyId || agency?.id || ''} />
              </TabsContent>

              <TabsContent value="history" className="mt-6">
                <PropertyAssignmentHistory agencyId={effectiveAgencyId || agency?.id || ''} />
              </TabsContent>

              <TabsContent value="subscription" className="mt-6">
                <SubscriptionManagement userId={effectiveOwnerId || ''} userRole="agency" />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AgencyDashboard;
