import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription, useCanCreateProperty } from '@/contexts/SubscriptionContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Lock, Zap, ArrowRight } from 'lucide-react';
import { getPricingRoute } from '@/utils/getPricingRoute';

interface SubscriptionGateProps {
  children: ReactNode;
  /** Type of check: 'subscription' only checks active subscription, 'property' also checks limits */
  type?: 'subscription' | 'property';
  /** Custom message when access is denied */
  message?: string;
  /** User role for pricing route */
  userRole?: string | null;
}

export function SubscriptionGate({ 
  children, 
  type = 'subscription',
  message,
  userRole,
}: SubscriptionGateProps) {
  const navigate = useNavigate();
  const { isLoading, hasSubscription, isActive, isSuspended, isPastDue, subscription } = useSubscription();
  const { canCreate, reason } = useCanCreateProperty();

  const pricingRoute = getPricingRoute(userRole, subscription?.plan?.name);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // No subscription at all
  if (!hasSubscription) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>Suscripción Requerida</CardTitle>
            <CardDescription>
              {message || 'Necesitas una suscripción activa para acceder a esta función.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate(pricingRoute)} className="w-full gap-2">
              <Zap className="h-4 w-4" />
              Ver Planes Disponibles
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Subscription suspended
  if (isSuspended) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md text-center border-destructive">
          <CardHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Cuenta Suspendida</CardTitle>
            <CardDescription>
              Tu cuenta ha sido suspendida por falta de pago. 
              Actualiza tu método de pago para continuar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="destructive" 
              onClick={() => navigate('/panel-agente?tab=subscription')} 
              className="w-full"
            >
              Reactivar Cuenta
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not active (canceled, expired, etc)
  if (!isActive) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center mb-4">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
            </div>
            <CardTitle>Suscripción Inactiva</CardTitle>
            <CardDescription>
              Tu suscripción ha expirado o fue cancelada. 
              Renueva para continuar usando todas las funciones.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate(pricingRoute)} className="w-full gap-2">
              <Zap className="h-4 w-4" />
              Renovar Suscripción
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // For property type, also check limits
  if (type === 'property' && !canCreate) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-yellow-600" />
            </div>
            <CardTitle>Límite Alcanzado</CardTitle>
            <CardDescription>
              {reason || 'Has alcanzado el límite de propiedades de tu plan.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={() => navigate('/panel-agente?tab=subscription')} className="w-full gap-2">
              <Zap className="h-4 w-4" />
              Actualizar Plan
            </Button>
            <Button variant="outline" onClick={() => navigate('/panel-agente')} className="w-full">
              Administrar Propiedades
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // All checks passed - render children
  return <>{children}</>;
}
