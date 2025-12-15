import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Crown, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  Settings,
  Zap
} from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { cn } from '@/lib/utils';
import { getPricingRoute } from '@/utils/getPricingRoute';

interface SubscriptionWidgetProps {
  userRole?: string | null;
}

export function SubscriptionWidget({ userRole }: SubscriptionWidgetProps = {}) {
  const {
    isLoading,
    hasSubscription,
    subscription,
    isActive,
    isTrial,
    isPastDue,
    isSuspended,
    trialDaysRemaining,
    limits,
  } = useSubscription();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-9 w-24" />
        </CardContent>
      </Card>
    );
  }

  const pricingRoute = getPricingRoute(userRole, subscription?.plan?.name);

  if (!hasSubscription) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            Sin Suscripción
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Contrata un plan para comenzar a publicar propiedades
          </p>
          <Button asChild size="sm">
            <Link to={pricingRoute}>Ver Planes</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = () => {
    if (isSuspended || isPastDue) return AlertTriangle;
    if (isTrial) return Clock;
    return Crown;
  };

  const getStatusColor = () => {
    if (isSuspended) return 'text-destructive';
    if (isPastDue) return 'text-yellow-600';
    if (isTrial) return 'text-blue-600';
    return 'text-primary';
  };

  const StatusIcon = getStatusIcon();

  return (
    <Card className={cn(
      (isPastDue || isSuspended) && 'border-destructive/50'
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <StatusIcon className={cn('h-4 w-4', getStatusColor())} />
            {subscription?.plan?.display_name || 'Mi Plan'}
          </CardTitle>
          
          {isTrial && trialDaysRemaining !== null && (
            <Badge variant="secondary" className="text-xs">
              {trialDaysRemaining} días restantes
            </Badge>
          )}
          
          {isPastDue && (
            <Badge variant="destructive" className="text-xs">
              Pago pendiente
            </Badge>
          )}
          
          {isSuspended && (
            <Badge variant="destructive" className="text-xs">
              Suspendida
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Property Usage */}
        {isActive && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Propiedades</span>
              <span className="font-medium">
                {limits.currentProperties} / {limits.maxProperties}
              </span>
            </div>
            <Progress 
              value={limits.usagePercent} 
              className={cn(
                'h-2',
                limits.isAtLimit && '[&>div]:bg-destructive',
                limits.isNearLimit && !limits.isAtLimit && '[&>div]:bg-yellow-500'
              )}
            />
            {limits.isAtLimit && (
              <p className="text-xs text-destructive">
                Límite alcanzado
              </p>
            )}
            {limits.isNearLimit && !limits.isAtLimit && (
              <p className="text-xs text-yellow-600">
                {limits.remainingProperties} restantes
              </p>
            )}
          </div>
        )}

        {/* Warning for past due */}
        {isPastDue && (
          <p className="text-sm text-destructive">
            Actualiza tu método de pago para evitar la suspensión.
          </p>
        )}

        {/* Warning for suspended */}
        {isSuspended && (
          <p className="text-sm text-destructive">
            Tu cuenta está suspendida. Reactívala para continuar.
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link to="/panel-agente?tab=subscription">
              <Settings className="h-3 w-3 mr-1" />
              Administrar
            </Link>
          </Button>
          
          {(limits.isNearLimit || limits.isAtLimit || isTrial) && (
            <Button asChild size="sm" className="flex-1">
              <Link to={pricingRoute}>
                <TrendingUp className="h-3 w-3 mr-1" />
                {isTrial ? 'Ver Planes' : 'Upgrade'}
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
