import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Pencil, 
  DollarSign, 
  Users, 
  Building2, 
  Briefcase,
  AlertTriangle,
  Check,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { EditPlanDialog } from '@/components/admin/EditPlanDialog';
import { formatPrice, calculateDiscountPercent } from '@/hooks/usePricingPlans';
import { useAdminCheck } from '@/hooks/useAdminCheck';

interface PlanFeatures {
  limits?: {
    max_properties?: number;
    featured_per_month?: number;
    max_agents?: number | null;
    max_projects?: number | null;
  };
  capabilities?: Record<string, boolean>;
  display?: {
    badge?: string | null;
    highlight?: boolean;
    cta_text?: string;
    short_description?: string;
  };
  feature_list?: Array<{
    text: string;
    icon: string;
    highlight: boolean;
  }>;
  [key: string]: unknown;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  display_name: string;
  price_monthly: number;
  price_yearly: number | null;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  features: PlanFeatures;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const AdminPlans = () => {
  const queryClient = useQueryClient();
  const { isAdmin, isSuperAdmin, loading: adminLoading } = useAdminCheck();
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);

  // Fetch all plans
  const { data: plans, isLoading } = useQuery({
    queryKey: ['admin-subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('price_monthly', { ascending: true });

      if (error) throw error;
      return data as SubscriptionPlan[];
    },
    enabled: isAdmin || isSuperAdmin,
  });

  // Fetch subscriber counts
  const { data: subscriberCounts } = useQuery({
    queryKey: ['plan-subscriber-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('plan_id')
        .in('status', ['active', 'trialing', 'past_due']);

      if (error) throw error;

      const counts: Record<string, number> = {};
      data.forEach(sub => {
        counts[sub.plan_id] = (counts[sub.plan_id] || 0) + 1;
      });
      return counts;
    },
    enabled: isAdmin || isSuperAdmin,
  });

  // Toggle plan active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ planId, isActive }: { planId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('subscription_plans')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', planId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscription-plans'] });
      queryClient.invalidateQueries({ queryKey: ['pricing-plans'] });
      toast.success('Estado del plan actualizado');
    },
    onError: () => {
      toast.error('Error al actualizar el estado');
    },
  });

  // Filter plans by type
  const agentPlans = plans?.filter(p => p.name.startsWith('agente_')) || [];
  const agencyPlans = plans?.filter(p => p.name.startsWith('inmobiliaria_')) || [];
  const developerPlans = plans?.filter(p => p.name.startsWith('desarrolladora_')) || [];

  const handleToggleActive = (planId: string, isActive: boolean, subscriberCount: number) => {
    if (!isActive && subscriberCount > 0) {
      toast.error(`No puedes desactivar este plan porque tiene ${subscriberCount} suscriptores activos`);
      return;
    }
    toggleActiveMutation.mutate({ planId, isActive });
  };

  const renderPlansTable = (plansList: SubscriptionPlan[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Plan</TableHead>
          <TableHead>Precio Mensual</TableHead>
          <TableHead>Precio Anual</TableHead>
          <TableHead>Descuento</TableHead>
          <TableHead>Features</TableHead>
          <TableHead>Suscriptores</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {plansList.map(plan => {
          const subCount = subscriberCounts?.[plan.id] || 0;
          const discount = plan.price_yearly 
            ? calculateDiscountPercent(plan.price_monthly, plan.price_yearly)
            : 0;

          return (
            <TableRow key={plan.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div>
                    <p className="font-medium">{plan.display_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{plan.name}</p>
                  </div>
                  {plan.features.display?.badge && (
                    <Badge variant="secondary" className="text-xs">
                      {plan.features.display.badge}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <span className="font-medium">
                  ${formatPrice(plan.price_monthly)}
                </span>
                <span className="text-muted-foreground text-sm"> MXN</span>
              </TableCell>
              <TableCell>
                {plan.price_yearly ? (
                  <>
                    <span className="font-medium">
                      ${formatPrice(plan.price_yearly)}
                    </span>
                    <span className="text-muted-foreground text-sm"> MXN</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {discount > 0 ? (
                  <Badge variant="default" className="bg-green-600">
                    {discount}% dto.
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {plan.features.feature_list?.length || 0} features
                </span>
              </TableCell>
              <TableCell>
                <Badge variant={subCount > 0 ? "default" : "secondary"}>
                  {subCount}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={plan.is_active}
                    onCheckedChange={(checked) => handleToggleActive(plan.id, checked, subCount)}
                    disabled={toggleActiveMutation.isPending}
                  />
                  {plan.is_active ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setEditingPlan(plan)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  if (adminLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto py-8 px-4">
          <Skeleton className="h-10 w-64 mb-8" />
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin && !isSuperAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto py-16 px-4 text-center">
          <h1 className="text-2xl font-bold text-destructive">Acceso Denegado</h1>
          <p className="text-muted-foreground mt-2">No tienes permisos para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <DollarSign className="h-8 w-8" />
              Gestión de Planes
            </h1>
            <p className="text-muted-foreground mt-1">
              Administra precios, límites y características de todos los planes de suscripción
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Los cambios se reflejan inmediatamente en las páginas de pricing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="agent">
              <TabsList className="mb-6">
                <TabsTrigger value="agent" className="gap-2">
                  <Users className="h-4 w-4" />
                  Agentes ({agentPlans.length})
                </TabsTrigger>
                <TabsTrigger value="agency" className="gap-2">
                  <Building2 className="h-4 w-4" />
                  Inmobiliarias ({agencyPlans.length})
                </TabsTrigger>
                <TabsTrigger value="developer" className="gap-2">
                  <Briefcase className="h-4 w-4" />
                  Desarrolladoras ({developerPlans.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="agent">
                {renderPlansTable(agentPlans)}
              </TabsContent>

              <TabsContent value="agency">
                {renderPlansTable(agencyPlans)}
              </TabsContent>

              <TabsContent value="developer">
                {renderPlansTable(developerPlans)}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {editingPlan && (
          <EditPlanDialog
            plan={editingPlan}
            open={!!editingPlan}
            onOpenChange={(open) => !open && setEditingPlan(null)}
            onSuccess={() => {
              setEditingPlan(null);
              queryClient.invalidateQueries({ queryKey: ['admin-subscription-plans'] });
              queryClient.invalidateQueries({ queryKey: ['pricing-plans'] });
            }}
          />
        )}
      </div>
    </div>
  );
};

export default AdminPlans;
