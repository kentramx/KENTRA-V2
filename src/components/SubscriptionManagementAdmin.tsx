import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { 
  Search, AlertCircle, XCircle, CheckCircle2, Clock, TrendingUp, 
  DollarSign, ExternalLink, Users, TrendingDown, CalendarPlus, RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  created_at: string;
  user_name: string;
  user_email: string;
  plan_name: string;
  plan_display_name: string;
  price_monthly: number;
  price_yearly: number;
}

interface Metrics {
  totalSubscriptions: number;
  activeCount: number;
  trialingCount: number;
  pastDueCount: number;
  canceledThisMonth: number;
  suspendedCount: number;
  mrr: number;
  churnRate: number;
}

interface Plan {
  id: string;
  name: string;
  display_name: string;
}

export const SubscriptionManagementAdmin = () => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [billingCycleFilter, setBillingCycleFilter] = useState<string>("all");
  
  // Dialogs
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [actionDialog, setActionDialog] = useState<'cancel' | 'reactivate' | 'extend' | 'change-plan' | null>(null);
  const [extendDays, setExtendDays] = useState(7);
  const [newPlanId, setNewPlanId] = useState<string>("");
  const [newBillingCycle, setNewBillingCycle] = useState<string>("monthly");

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('admin-get-subscriptions');

      if (error) throw error;

      setSubscriptions(data.subscriptions || []);
      setMetrics(data.metrics || null);
      setPlans(data.plans || []);
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      toast.error('Error al cargar suscripciones');
    } finally {
      setLoading(false);
    }
  };

  const filteredSubscriptions = subscriptions.filter(sub => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      sub.user_name.toLowerCase().includes(searchLower) ||
      sub.user_email.toLowerCase().includes(searchLower) ||
      sub.plan_display_name.toLowerCase().includes(searchLower);
    
    const matchesStatus = statusFilter === "all" || sub.status === statusFilter;
    const matchesPlan = planFilter === "all" || sub.plan_id === planFilter;
    const matchesBilling = billingCycleFilter === "all" || sub.billing_cycle === billingCycleFilter;
    
    return matchesSearch && matchesStatus && matchesPlan && matchesBilling;
  });

  const handleCancelSubscription = async () => {
    if (!selectedSubscription) return;

    try {
      setActionLoading(true);
      const { error } = await supabase.functions.invoke('admin-subscription-action', {
        body: { 
          action: 'cancel',
          userId: selectedSubscription.user_id 
        }
      });

      if (error) throw error;

      toast.success('Suscripción cancelada exitosamente');
      fetchSubscriptions();
    } catch (error) {
      console.error('Error canceling subscription:', error);
      toast.error('Error al cancelar suscripción');
    } finally {
      setActionLoading(false);
      setActionDialog(null);
      setSelectedSubscription(null);
    }
  };

  const handleReactivateSubscription = async () => {
    if (!selectedSubscription) return;

    try {
      setActionLoading(true);
      const { error } = await supabase.functions.invoke('admin-subscription-action', {
        body: { 
          action: 'reactivate',
          userId: selectedSubscription.user_id 
        }
      });

      if (error) throw error;

      toast.success('Suscripción reactivada exitosamente');
      fetchSubscriptions();
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      toast.error('Error al reactivar suscripción');
    } finally {
      setActionLoading(false);
      setActionDialog(null);
      setSelectedSubscription(null);
    }
  };

  const handleExtendTrial = async () => {
    if (!selectedSubscription) return;

    try {
      setActionLoading(true);
      const { error } = await supabase.functions.invoke('admin-extend-trial', {
        body: { 
          userId: selectedSubscription.user_id,
          days: extendDays
        }
      });

      if (error) throw error;

      toast.success(`Trial extendido ${extendDays} días`);
      fetchSubscriptions();
    } catch (error: unknown) {
      console.error('Error extending trial:', error);
      toast.error(error instanceof Error ? error.message : 'Error al extender trial');
    } finally {
      setActionLoading(false);
      setActionDialog(null);
      setSelectedSubscription(null);
      setExtendDays(7);
    }
  };

  const handleChangePlan = async () => {
    if (!selectedSubscription || !newPlanId) return;

    try {
      setActionLoading(true);
      const { error } = await supabase.functions.invoke('admin-subscription-action', {
        body: { 
          action: 'change-plan',
          userId: selectedSubscription.user_id,
          params: {
            newPlanId,
            billingCycle: newBillingCycle
          }
        }
      });

      if (error) throw error;

      toast.success('Plan actualizado exitosamente');
      fetchSubscriptions();
    } catch (error) {
      console.error('Error changing plan:', error);
      toast.error('Error al cambiar plan');
    } finally {
      setActionLoading(false);
      setActionDialog(null);
      setSelectedSubscription(null);
      setNewPlanId("");
    }
  };

  const openStripeSubscription = (stripeSubscriptionId: string) => {
    if (stripeSubscriptionId) {
      window.open(`https://dashboard.stripe.com/subscriptions/${stripeSubscriptionId}`, '_blank');
    } else {
      toast.error('Esta suscripción no tiene ID de Stripe');
    }
  };

  const getStatusBadge = (status: string, cancelAtPeriodEnd: boolean) => {
    if (cancelAtPeriodEnd) {
      return <Badge variant="outline" className="border-orange-500 text-orange-500">Cancelando</Badge>;
    }

    switch (status) {
      case 'active':
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Activa</Badge>;
      case 'past_due':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Pago Pendiente</Badge>;
      case 'canceled':
        return <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" />Cancelada</Badge>;
      case 'trialing':
        return <Badge className="bg-blue-500"><Clock className="h-3 w-3 mr-1" />Trial</Badge>;
      case 'suspended':
        return <Badge variant="secondary">Suspendida</Badge>;
      case 'incomplete':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-500">Incompleta</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatPrice = (sub: Subscription) => {
    const price = sub.billing_cycle === 'yearly' ? sub.price_yearly : sub.price_monthly;
    const cycle = sub.billing_cycle === 'yearly' ? '/año' : '/mes';
    return `$${price?.toLocaleString('es-MX') || 0}${cycle}`;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalSubscriptions || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{metrics?.activeCount || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Trial</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{metrics?.trialingCount || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pago Pendiente</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{metrics?.pastDueCount || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics?.mrr?.toLocaleString('es-MX') || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{metrics?.churnRate || 0}%</div>
            <p className="text-xs text-muted-foreground">{metrics?.canceledThisMonth || 0} este mes</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Gestión de Suscripciones</CardTitle>
            <CardDescription>Administra todas las suscripciones del sistema</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchSubscriptions}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, email o plan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Activas</SelectItem>
                <SelectItem value="trialing">En Trial</SelectItem>
                <SelectItem value="past_due">Pago Pendiente</SelectItem>
                <SelectItem value="canceled">Canceladas</SelectItem>
                <SelectItem value="suspended">Suspendidas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los planes</SelectItem>
                {plans.map(plan => (
                  <SelectItem key={plan.id} value={plan.id}>{plan.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={billingCycleFilter} onValueChange={setBillingCycleFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Ciclo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="monthly">Mensual</SelectItem>
                <SelectItem value="yearly">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Ciclo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Renovación</TableHead>
                  <TableHead>Creada</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubscriptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No se encontraron suscripciones
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSubscriptions.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{sub.user_name}</p>
                          <p className="text-sm text-muted-foreground">{sub.user_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{sub.plan_display_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {sub.billing_cycle === 'yearly' ? 'Anual' : 'Mensual'}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(sub.status, sub.cancel_at_period_end)}</TableCell>
                      <TableCell>{formatPrice(sub)}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(sub.current_period_end).toLocaleDateString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(sub.created_at).toLocaleDateString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 flex-wrap">
                          {/* View in Stripe */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openStripeSubscription(sub.stripe_subscription_id)}
                            title="Ver en Stripe"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>

                          {/* Extend Trial */}
                          {sub.status === 'trialing' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedSubscription(sub);
                                setActionDialog('extend');
                              }}
                              title="Extender Trial"
                            >
                              <CalendarPlus className="h-4 w-4" />
                            </Button>
                          )}

                          {/* Change Plan */}
                          {(sub.status === 'active' || sub.status === 'trialing') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedSubscription(sub);
                                setNewPlanId(sub.plan_id);
                                setNewBillingCycle(sub.billing_cycle);
                                setActionDialog('change-plan');
                              }}
                            >
                              Cambiar
                            </Button>
                          )}

                          {/* Cancel */}
                          {sub.status === 'active' && !sub.cancel_at_period_end && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSelectedSubscription(sub);
                                setActionDialog('cancel');
                              }}
                            >
                              Cancelar
                            </Button>
                          )}

                          {/* Reactivate */}
                          {(sub.cancel_at_period_end || sub.status === 'canceled') && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => {
                                setSelectedSubscription(sub);
                                setActionDialog('reactivate');
                              }}
                            >
                              Reactivar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Cancel Dialog */}
      <AlertDialog open={actionDialog === 'cancel'} onOpenChange={(open) => !open && setActionDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar suscripción?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción cancelará la suscripción de <strong>{selectedSubscription?.user_name}</strong> ({selectedSubscription?.user_email}).
              La cancelación será efectiva al final del período actual.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCancelSubscription} 
              className="bg-red-500"
              disabled={actionLoading}
            >
              {actionLoading ? 'Procesando...' : 'Confirmar Cancelación'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reactivate Dialog */}
      <AlertDialog open={actionDialog === 'reactivate'} onOpenChange={(open) => !open && setActionDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reactivar suscripción?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción reactivará la suscripción de <strong>{selectedSubscription?.user_name}</strong>.
              Si la suscripción tenía pagos pendientes, se intentará cobrar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReactivateSubscription} disabled={actionLoading}>
              {actionLoading ? 'Procesando...' : 'Confirmar Reactivación'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Extend Trial Dialog */}
      <Dialog open={actionDialog === 'extend'} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extender Trial</DialogTitle>
            <DialogDescription>
              Extiende el período de prueba de <strong>{selectedSubscription?.user_name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="days">Días a agregar</Label>
            <Input
              id="days"
              type="number"
              min={1}
              max={90}
              value={extendDays}
              onChange={(e) => setExtendDays(parseInt(e.target.value) || 7)}
              className="mt-2"
            />
            <p className="text-sm text-muted-foreground mt-2">
              Nueva fecha de expiración: {selectedSubscription && new Date(
                new Date(selectedSubscription.current_period_end).getTime() + extendDays * 24 * 60 * 60 * 1000
              ).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)} disabled={actionLoading}>
              Cancelar
            </Button>
            <Button onClick={handleExtendTrial} disabled={actionLoading}>
              {actionLoading ? 'Procesando...' : 'Extender Trial'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Plan Dialog */}
      <Dialog open={actionDialog === 'change-plan'} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar Plan</DialogTitle>
            <DialogDescription>
              Cambia el plan de <strong>{selectedSubscription?.user_name}</strong>.
              Se aplicará prorrateo automático.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>Nuevo Plan</Label>
              <Select value={newPlanId} onValueChange={setNewPlanId}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Selecciona un plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map(plan => (
                    <SelectItem key={plan.id} value={plan.id}>{plan.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ciclo de Facturación</Label>
              <Select value={newBillingCycle} onValueChange={setNewBillingCycle}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensual</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)} disabled={actionLoading}>
              Cancelar
            </Button>
            <Button onClick={handleChangePlan} disabled={actionLoading || !newPlanId}>
              {actionLoading ? 'Procesando...' : 'Cambiar Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
