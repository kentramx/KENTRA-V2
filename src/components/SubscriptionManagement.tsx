import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Calendar, CreditCard, TrendingUp, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { ChangePlanDialog } from './ChangePlanDialog';
import { ActiveUpsells } from './ActiveUpsells';

interface SubscriptionManagementProps {
  userId: string;
}

interface SubscriptionDetails {
  plan_id: string;
  plan_name: string;
  plan_display_name: string;
  status: string;
  billing_cycle: string;
  price_monthly: number;
  price_yearly: number;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  features: any;
}

interface PaymentRecord {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_type: string;
  created_at: string;
  metadata: any;
}

export const SubscriptionManagement = ({ userId }: SubscriptionManagementProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [showChangePlanDialog, setShowChangePlanDialog] = useState(false);

  useEffect(() => {
    fetchSubscriptionData();
  }, [userId]);

  const fetchSubscriptionData = async () => {
    try {
      // Obtener suscripción actual (active, canceled, or expired)
      const { data: subData, error: subError } = await supabase
        .from('user_subscriptions')
        .select(`
          plan_id,
          status,
          billing_cycle,
          current_period_start,
          current_period_end,
          cancel_at_period_end,
          subscription_plans (
            name,
            display_name,
            price_monthly,
            price_yearly,
            features
          )
        `)
        .eq('user_id', userId)
        .in('status', ['active', 'canceled', 'expired', 'past_due'])
        .order('current_period_end', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError) throw subError;

      if (subData && subData.subscription_plans) {
        setSubscription({
          plan_id: subData.plan_id,
          plan_name: subData.subscription_plans.name,
          plan_display_name: subData.subscription_plans.display_name,
          status: subData.status,
          billing_cycle: subData.billing_cycle,
          price_monthly: Number(subData.subscription_plans.price_monthly),
          price_yearly: Number(subData.subscription_plans.price_yearly),
          current_period_start: subData.current_period_start,
          current_period_end: subData.current_period_end,
          cancel_at_period_end: subData.cancel_at_period_end,
          features: subData.subscription_plans.features,
        });
      }

      // Obtener historial de pagos
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payment_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (paymentsError) throw paymentsError;

      setPayments(paymentsData || []);
    } catch (error) {
      console.error('Error fetching subscription data:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cargar la información de la suscripción',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    // Prevenir doble click
    if (canceling) return;
    
    setCanceling(true);
    try {
      const { data, error } = await supabase.functions.invoke('cancel-subscription', {
        method: 'POST',
      });

      if (error) throw error;

      toast({
        title: 'Suscripción cancelada',
        description: 'Tu suscripción se cancelará al final del período actual',
      });

      // Recargar datos
      await fetchSubscriptionData();
    } catch (error) {
      console.error('Error canceling subscription:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cancelar la suscripción. Intenta de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setCanceling(false);
    }
  };

  const handleChangePlan = () => {
    setShowChangePlanDialog(true);
  };

  const handleChangePlanSuccess = () => {
    fetchSubscriptionData();
  };

  const getStatusBadge = (status: string) => {
    const isActive = status === 'active' || status === 'trialing';
    if (isActive) {
      return <Badge className="bg-green-600">Activo</Badge>;
    }
    return <Badge variant="secondary">No Activo</Badge>;
  };

  const getPaymentStatusIcon = (status: string) => {
    switch (status) {
      case 'succeeded':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'pending':
        return <Loader2 className="h-4 w-4 text-amber-600 animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Determinar si la suscripción está activa
  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing';

  if (!subscription || !isActive) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Actualmente no tienes una suscripción activa</h3>
            <p className="text-muted-foreground mb-4">
              Contrata un plan para comenzar a publicar tus propiedades
            </p>
            <Button onClick={() => navigate('/pricing-agente')}>
              Contratar un Plan
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentPrice = subscription.billing_cycle === 'yearly' 
    ? subscription.price_yearly 
    : subscription.price_monthly;

  return (
    <>
      <ChangePlanDialog
        open={showChangePlanDialog}
        onOpenChange={setShowChangePlanDialog}
        currentPlanId={subscription?.plan_id || ''}
        currentPlanName={subscription?.plan_name || ''}
        currentBillingCycle={subscription?.billing_cycle || 'monthly'}
        userId={userId}
        onSuccess={handleChangePlanSuccess}
      />
      
      <div className="space-y-6">
        {/* Current Subscription Card */}
        <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{subscription.plan_display_name}</CardTitle>
              <CardDescription className="mt-2">
                Plan {subscription.billing_cycle === 'yearly' ? 'Anual' : 'Mensual'}
              </CardDescription>
            </div>
            {getStatusBadge(subscription.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Price */}
          <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
            <CreditCard className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Precio actual</p>
              <p className="text-2xl font-bold">
                ${currentPrice.toLocaleString('es-MX')} MXN
                <span className="text-sm font-normal text-muted-foreground">
                  /{subscription.billing_cycle === 'yearly' ? 'año' : 'mes'}
                </span>
              </p>
            </div>
          </div>

          {/* Period Dates */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <Calendar className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Inicio del período</p>
                <p className="font-semibold">
                  {format(new Date(subscription.current_period_start), "d 'de' MMMM, yyyy", { locale: es })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <Calendar className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Próxima renovación</p>
                <p className="font-semibold">
                  {format(new Date(subscription.current_period_end), "d 'de' MMMM, yyyy", { locale: es })}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Actions - Solo para suscripciones activas */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={handleChangePlan} 
              className="flex-1 gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              Cambiar de Plan
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="flex-1">
                  Cancelar Suscripción
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Cancelar suscripción?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tu suscripción se cancelará al final del período de facturación actual el{' '}
                    {format(new Date(subscription.current_period_end), "d 'de' MMMM, yyyy", { locale: es })}.
                    Podrás seguir usando todas las funciones hasta esa fecha.
                    <br /><br />
                    Esta acción no se puede deshacer, pero podrás suscribirte nuevamente en cualquier momento.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>No, mantener suscripción</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancelSubscription}
                    disabled={canceling}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {canceling ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Cancelando...
                      </>
                    ) : (
                      'Sí, cancelar'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Pagos</CardTitle>
          <CardDescription>
            Últimos {payments.length} pagos realizados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No hay pagos registrados</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        {format(new Date(payment.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell className="capitalize">
                        {payment.payment_type === 'subscription' ? 'Suscripción' : payment.payment_type}
                      </TableCell>
                      <TableCell className="font-semibold">
                        ${payment.amount.toLocaleString('es-MX')} {payment.currency}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getPaymentStatusIcon(payment.status)}
                          <span className="capitalize text-sm">
                            {payment.status === 'succeeded' && 'Exitoso'}
                            {payment.status === 'pending' && 'Pendiente'}
                            {payment.status === 'failed' && 'Fallido'}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Upsells Section */}
      <ActiveUpsells userId={userId} />
      </div>
    </>
  );
};
