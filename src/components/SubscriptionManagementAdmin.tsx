import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Search, Calendar, CreditCard, AlertCircle, XCircle, CheckCircle2, Clock, TrendingUp, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  stripe_subscription_id: string;
  created_at: string;
  profiles: {
    name: string;
    email: string;
  };
  subscription_plans: {
    display_name: string;
    price_monthly: number;
  };
}

export const SubscriptionManagementAdmin = () => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [actionDialog, setActionDialog] = useState<'cancel' | 'reactivate' | 'extend' | null>(null);

  useEffect(() => {
    fetchSubscriptions();
  }, [statusFilter]);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('user_subscriptions')
        .select(`
          *,
          profiles!user_subscriptions_user_id_fkey (
            name
          ),
          subscription_plans (
            display_name,
            price_monthly
          )
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Obtener emails de auth.users
      const subsWithEmails = await Promise.all(
        (data || []).map(async (sub: any) => {
          const { data: userData } = await supabase.auth.admin.getUserById(sub.user_id);
          return {
            ...sub,
            profiles: {
              name: sub.profiles?.name || 'Usuario',
              email: userData?.user?.email || 'Sin email'
            }
          };
        })
      );

      setSubscriptions(subsWithEmails as Subscription[]);
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      toast.error('Error al cargar suscripciones');
    } finally {
      setLoading(false);
    }
  };

  const filteredSubscriptions = subscriptions.filter(sub => {
    const searchLower = searchTerm.toLowerCase();
    return (
      sub.profiles.name.toLowerCase().includes(searchLower) ||
      sub.profiles.email.toLowerCase().includes(searchLower) ||
      sub.subscription_plans.display_name.toLowerCase().includes(searchLower)
    );
  });

  const handleCancelSubscription = async () => {
    if (!selectedSubscription) return;

    try {
      const { error } = await supabase.functions.invoke('cancel-subscription', {
        body: { subscriptionId: selectedSubscription.stripe_subscription_id }
      });

      if (error) throw error;

      toast.success('Suscripción cancelada exitosamente');
      fetchSubscriptions();
      setActionDialog(null);
      setSelectedSubscription(null);
    } catch (error) {
      console.error('Error canceling subscription:', error);
      toast.error('Error al cancelar suscripción');
    }
  };

  const handleReactivateSubscription = async () => {
    if (!selectedSubscription) return;

    try {
      const { error } = await supabase.functions.invoke('reactivate-subscription', {
        body: { subscriptionId: selectedSubscription.stripe_subscription_id }
      });

      if (error) throw error;

      toast.success('Suscripción reactivada exitosamente');
      fetchSubscriptions();
      setActionDialog(null);
      setSelectedSubscription(null);
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      toast.error('Error al reactivar suscripción');
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
      case 'expired':
        return <Badge variant="secondary">Expirada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Suscripciones</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscriptions.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {subscriptions.filter(s => s.status === 'active').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pago Pendiente</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {subscriptions.filter(s => s.status === 'past_due').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR Estimado</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${subscriptions
                .filter(s => s.status === 'active')
                .reduce((acc, s) => acc + Number(s.subscription_plans.price_monthly), 0)
                .toLocaleString('es-MX')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Suscripciones</CardTitle>
          <CardDescription>Administra y monitorea todas las suscripciones del sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, email o plan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Activas</SelectItem>
                <SelectItem value="past_due">Pago Pendiente</SelectItem>
                <SelectItem value="canceled">Canceladas</SelectItem>
                <SelectItem value="trialing">Trial</SelectItem>
                <SelectItem value="expired">Expiradas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Plan</TableHead>
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
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No se encontraron suscripciones
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSubscriptions.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{sub.profiles.name}</p>
                          <p className="text-sm text-muted-foreground">{sub.profiles.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{sub.subscription_plans.display_name}</TableCell>
                      <TableCell>{getStatusBadge(sub.status, sub.cancel_at_period_end)}</TableCell>
                      <TableCell>${sub.subscription_plans.price_monthly.toLocaleString('es-MX')}</TableCell>
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
                        <div className="flex justify-end gap-2">
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
              Esta acción cancelará la suscripción de <strong>{selectedSubscription?.profiles.name}</strong>.
              La cancelación será efectiva al final del período actual.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelSubscription} className="bg-red-500">
              Confirmar Cancelación
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
              Esta acción reactivará la suscripción de <strong>{selectedSubscription?.profiles.name}</strong>.
              Se intentará cobrar inmediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReactivateSubscription}>
              Confirmar Reactivación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
