import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Calendar, CreditCard, TrendingUp, AlertCircle, Loader2, RefreshCcw, FileText, Package } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChangePlanDialog } from './subscription/change-plan';
import { ActiveUpsells } from './ActiveUpsells';
import { InvoiceHistory } from './InvoiceHistory';
import { SubscriptionErrorBoundary } from './subscription/SubscriptionErrorBoundary';
import { SubscriptionCardSkeleton } from './subscription/SubscriptionSkeletons';
import { useSubscriptionRealtime } from '@/hooks/useSubscriptionRealtime';
import { useSubscriptionActions } from '@/hooks/useSubscriptionActions';
import { getPricingRoute } from '@/utils/getPricingRoute';
import type { SubscriptionFeatures } from '@/types/subscription';

interface SubscriptionManagementProps {
  userId: string;
  userRole?: 'agent' | 'agency' | 'developer';
}

export const SubscriptionManagement = ({ userId, userRole }: SubscriptionManagementProps) => {
  return (
    <SubscriptionErrorBoundary>
      <SubscriptionManagementContent userId={userId} userRole={userRole} />
    </SubscriptionErrorBoundary>
  );
};

function SubscriptionManagementContent({ userId, userRole }: SubscriptionManagementProps) {
  const navigate = useNavigate();
  const [showChangePlanDialog, setShowChangePlanDialog] = useState(false);
  const pricingRoute = getPricingRoute(userRole);

  // Use realtime hook for subscription data
  const { subscription: realtimeSubscription, loading, refetch } = useSubscriptionRealtime({
    userId,
    showToasts: true,
    onStatusChange: (oldStatus, newStatus) => {
      console.log(`[SubscriptionManagement] Status changed: ${oldStatus} -> ${newStatus}`);
    },
  });

  // Use actions hook for cancel/reactivate/portal
  const { 
    cancel, 
    reactivate, 
    openPortal,
    isCanceling,
    isReactivating,
    isOpeningPortal,
  } = useSubscriptionActions({
    onSuccess: () => {
      refetch();
    },
  });

  // Transform realtime data to match expected shape
  const subscription = realtimeSubscription ? {
    plan_id: realtimeSubscription.plan_id,
    plan_name: realtimeSubscription.subscription_plans?.name || '',
    plan_display_name: realtimeSubscription.subscription_plans?.display_name || '',
    status: realtimeSubscription.status,
    billing_cycle: realtimeSubscription.billing_cycle || 'monthly',
    price_monthly: realtimeSubscription.subscription_plans?.price_monthly || 0,
    price_yearly: realtimeSubscription.subscription_plans?.price_yearly || 0,
    current_period_start: realtimeSubscription.current_period_start || '',
    current_period_end: realtimeSubscription.current_period_end || '',
    cancel_at_period_end: realtimeSubscription.cancel_at_period_end || false,
    features: (realtimeSubscription.subscription_plans?.features || {}) as SubscriptionFeatures,
  } : null;

  const handleChangePlan = () => {
    setShowChangePlanDialog(true);
  };

  const handleChangePlanSuccess = () => {
    refetch();
  };

  const handleCancelSubscription = async () => {
    if (subscription) {
      await cancel({
        status: subscription.status,
        cancel_at_period_end: subscription.cancel_at_period_end,
        plan_id: subscription.plan_id,
      });
    }
  };

  const handleReactivateSubscription = async () => {
    if (subscription) {
      await reactivate({
        status: subscription.status,
        cancel_at_period_end: subscription.cancel_at_period_end,
        plan_id: subscription.plan_id,
      });
    }
  };

  const handleManagePayment = async () => {
    await openPortal();
  };

  const getStatusBadge = (status: string) => {
    const isActive = status === 'active' || status === 'trialing';
    if (isActive) {
      return <Badge className="bg-green-600">Activo</Badge>;
    }
    return <Badge variant="secondary">No Activo</Badge>;
  };

  // Show skeleton while loading
  if (loading) {
    return <SubscriptionCardSkeleton />;
  }

  // Determine if subscription is active
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
            <Button onClick={() => navigate(pricingRoute)}>
              Contratar un Plan
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Check if subscription has expired (cancel_at_period_end but date passed)
  const isExpired = subscription.cancel_at_period_end && 
                    new Date(subscription.current_period_end) < new Date();

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
      
      <Tabs defaultValue="subscription" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="subscription" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Suscripción
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-2">
            <FileText className="h-4 w-4" />
            Facturas
          </TabsTrigger>
          <TabsTrigger value="upsells" className="gap-2">
            <Package className="h-4 w-4" />
            Servicios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subscription" className="space-y-6">
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
            <div className="flex items-center gap-2">
              {subscription.status === 'trialing' && subscription.current_period_end && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">
                  🎁 {Math.max(0, Math.ceil((new Date(subscription.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} días restantes
                </Badge>
              )}
              {getStatusBadge(subscription.status)}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Banner for scheduled cancellation or expired */}
          {subscription.cancel_at_period_end && (
            isExpired ? (
              <Alert className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-500 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-red-800 dark:text-red-500 mb-1">
                      Suscripción Finalizada
                    </h4>
                    <p className="text-sm text-red-700 dark:text-red-600 mb-3">
                      Tu suscripción finalizó el{' '}
                      <strong>{format(new Date(subscription.current_period_end), "d 'de' MMMM, yyyy", { locale: es })}</strong>.
                      Contrata un nuevo plan para continuar publicando propiedades.
                    </p>
                    <Button
                      onClick={() => navigate(pricingRoute)}
                      variant="destructive"
                      size="sm"
                    >
                      Ver Planes Disponibles
                    </Button>
                  </div>
                </div>
              </Alert>
            ) : (
              <Alert className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-yellow-800 dark:text-yellow-500 mb-1">
                      Cancelación programada
                    </h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-600">
                      Tu suscripción finalizará el{' '}
                      <strong>{format(new Date(subscription.current_period_end), "d 'de' MMMM, yyyy", { locale: es })}</strong>.
                      Después de esa fecha podrás contratar un nuevo plan.
                    </p>
                  </div>
                </div>
              </Alert>
            )
          )}

          {/* Price */}
          <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
            <CreditCard className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Precio actual</p>
              <p className="text-2xl font-bold">
                ${currentPrice?.toLocaleString('es-MX')} MXN
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
                  {subscription.current_period_start && format(new Date(subscription.current_period_start), "d 'de' MMMM, yyyy", { locale: es })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <Calendar className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Próxima renovación</p>
                <p className="font-semibold">
                  {subscription.current_period_end && format(new Date(subscription.current_period_end), "d 'de' MMMM, yyyy", { locale: es })}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Reactivate - Show ONLY if cancellation scheduled AND NOT expired */}
            {subscription.cancel_at_period_end && !isExpired && (
              <Button 
                onClick={handleReactivateSubscription}
                disabled={isReactivating}
                className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white"
              >
                {isReactivating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Reactivando...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="h-4 w-4" />
                    Reactivar Suscripción
                  </>
                )}
              </Button>
            )}

            {/* New plan - Show ONLY if expired */}
            {isExpired && (
              <Button 
                onClick={() => navigate(pricingRoute)}
                className="flex-1 gap-2"
                variant="default"
              >
                Contratar Nuevo Plan
              </Button>
            )}

            {/* Change Plan - available always if active */}
            {(subscription.status === 'active' || subscription.status === 'trialing') && (
              <Button 
                onClick={handleChangePlan} 
                variant={subscription.cancel_at_period_end ? "outline" : "default"}
                className="flex-1 gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                Cambiar de Plan
              </Button>
            )}

            {/* Manage payment method - Only if active */}
            {(subscription.status === 'active' || subscription.status === 'trialing') && (
              <Button 
                variant="outline" 
                onClick={handleManagePayment}
                disabled={isOpeningPortal}
                className="flex-1 gap-2"
              >
                <CreditCard className="h-4 w-4" />
                {isOpeningPortal ? 'Abriendo...' : 'Actualizar Método de Pago'}
              </Button>
            )}
            
            {/* Cancel - Only if NO scheduled cancellation */}
            {(subscription.status === 'active' || subscription.status === 'trialing') && 
             !subscription.cancel_at_period_end && (
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
                      {subscription.current_period_end && format(new Date(subscription.current_period_end), "d 'de' MMMM, yyyy", { locale: es })}.
                      Podrás seguir usando todas las funciones hasta esa fecha.
                      <br /><br />
                      Esta acción no se puede deshacer, pero podrás suscribirte nuevamente en cualquier momento.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>No, mantener suscripción</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancelSubscription}
                      disabled={isCanceling}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isCanceling ? (
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
            )}
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <InvoiceHistory userId={userId} />
        </TabsContent>

        <TabsContent value="upsells">
          <ActiveUpsells userId={userId} />
        </TabsContent>
      </Tabs>
    </>
  );
}
