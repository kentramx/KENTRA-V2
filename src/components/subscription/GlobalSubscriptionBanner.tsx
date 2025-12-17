import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, AlertTriangle, Clock, CreditCard, AlertCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { getPricingRoute } from '@/utils/getPricingRoute';
import { getSubscriptionPanelRoute } from '@/utils/getPanelRoute';
type BannerType = 'payment_failed' | 'trial_expiring' | 'subscription_expiring' | 'suspended' | 'incomplete' | 'at_limit' | 'near_limit';

interface BannerConfig {
  type: BannerType;
  icon: React.ElementType;
  title: string;
  message: string;
  action: {
    label: string;
    href: string;
  };
  variant: 'destructive' | 'warning' | 'info';
  dismissable: boolean;
  priority: number;
}

export function GlobalSubscriptionBanner() {
  const { user } = useAuth();
  const { 
    alerts, 
    subscription, 
    trialDaysRemaining, 
    limits, 
    isPastDue, 
    isSuspended,
    isLoading,
    hasSubscription,
  } = useSubscription();
  const [dismissed, setDismissed] = useState<Set<BannerType>>(new Set());

  // Reset dismissed on subscription change
  useEffect(() => {
    setDismissed(new Set());
  }, [subscription?.id]);

  // Don't render if not logged in, loading, or no subscription
  if (!user || isLoading || !hasSubscription) return null;

  const pricingRoute = getPricingRoute(null, subscription?.plan?.name);
  const subscriptionPanelRoute = getSubscriptionPanelRoute(null, subscription?.plan?.name);

  const getBanners = (): BannerConfig[] => {
    const banners: BannerConfig[] = [];

    // Suspended - highest priority
    if (isSuspended) {
      banners.push({
        type: 'suspended',
        icon: AlertTriangle,
        title: 'Cuenta Suspendida',
        message: 'Tu cuenta ha sido suspendida por falta de pago. Actualiza tu método de pago para reactivar.',
        action: { label: 'Reactivar Cuenta', href: subscriptionPanelRoute },
        variant: 'destructive',
        dismissable: false,
        priority: 1,
      });
    }

    // Incomplete payment (OXXO/SPEI pending) - high priority
    if (subscription?.status === 'incomplete' && !dismissed.has('incomplete')) {
      banners.push({
        type: 'incomplete',
        icon: Clock,
        title: 'Pago Pendiente',
        message: 'Tu pago con OXXO o SPEI está pendiente de confirmación. Puede tardar hasta 48 horas.',
        action: { label: 'Ver Estado', href: subscriptionPanelRoute },
        variant: 'warning',
        dismissable: false,
        priority: 1.5,
      });
    }

    // Payment failed
    if (alerts.showPaymentFailed && !isSuspended) {
      banners.push({
        type: 'payment_failed',
        icon: CreditCard,
        title: 'Pago Fallido',
        message: 'Hubo un problema con tu último pago. Actualiza tu método de pago para evitar la suspensión.',
        action: { label: 'Actualizar Pago', href: subscriptionPanelRoute },
        variant: 'destructive',
        dismissable: false,
        priority: 2,
      });
    }

    // Trial expiring
    if (alerts.showTrialExpiring && !dismissed.has('trial_expiring')) {
      banners.push({
        type: 'trial_expiring',
        icon: Clock,
        title: `Tu prueba gratuita termina en ${trialDaysRemaining} día${trialDaysRemaining !== 1 ? 's' : ''}`,
        message: 'Elige un plan para continuar publicando tus propiedades sin interrupción.',
        action: { label: 'Ver Planes', href: pricingRoute },
        variant: 'warning',
        dismissable: true,
        priority: 3,
      });
    }

    // Subscription expiring (cancel_at_period_end)
    if (alerts.showSubscriptionExpiring && !dismissed.has('subscription_expiring')) {
      const daysLeft = subscription?.currentPeriodEnd 
        ? Math.ceil((subscription.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 0;
      banners.push({
        type: 'subscription_expiring',
        icon: AlertCircle,
        title: `Tu suscripción se cancela en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}`,
        message: 'Reactiva tu suscripción para mantener acceso a todas las funciones.',
        action: { label: 'Reactivar', href: subscriptionPanelRoute },
        variant: 'warning',
        dismissable: true,
        priority: 4,
      });
    }

    // At property limit
    if (alerts.showAtPropertyLimit && !dismissed.has('at_limit')) {
      banners.push({
        type: 'at_limit',
        icon: Zap,
        title: 'Límite de Propiedades Alcanzado',
        message: `Has usado ${limits.currentProperties}/${limits.maxProperties} propiedades. Actualiza tu plan para publicar más.`,
        action: { label: 'Actualizar Plan', href: subscriptionPanelRoute },
        variant: 'info',
        dismissable: true,
        priority: 5,
      });
    }

    // Near property limit
    if (alerts.showNearPropertyLimit && !dismissed.has('near_limit') && !alerts.showAtPropertyLimit) {
      banners.push({
        type: 'near_limit',
        icon: AlertCircle,
        title: `${limits.remainingProperties} propiedades restantes`,
        message: `Has usado ${limits.currentProperties}/${limits.maxProperties} propiedades de tu plan.`,
        action: { label: 'Ver Opciones', href: subscriptionPanelRoute },
        variant: 'info',
        dismissable: true,
        priority: 6,
      });
    }

    return banners.sort((a, b) => a.priority - b.priority);
  };

  const banners = getBanners();
  const activeBanner = banners.find(b => !dismissed.has(b.type));

  if (!activeBanner) return null;

  const variantStyles = {
    destructive: 'bg-destructive text-destructive-foreground',
    warning: 'bg-yellow-500 text-white',
    info: 'bg-blue-500 text-white',
  };

  return (
    <div className={cn(
      'w-full px-4 py-3 flex items-center justify-between gap-4',
      variantStyles[activeBanner.variant]
    )}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <activeBanner.icon className="h-5 w-5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-medium">{activeBanner.title}</span>
          <span className="hidden sm:inline ml-2 opacity-90">— {activeBanner.message}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          asChild
          size="sm"
          variant={activeBanner.variant === 'destructive' ? 'secondary' : 'outline'}
          className={cn(
            activeBanner.variant !== 'destructive' && 'bg-white/20 border-white/30 hover:bg-white/30 text-white'
          )}
        >
          <Link to={activeBanner.action.href}>
            {activeBanner.action.label}
          </Link>
        </Button>
        
        {activeBanner.dismissable && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 hover:bg-white/20"
            onClick={() => setDismissed(prev => new Set(prev).add(activeBanner.type))}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Cerrar</span>
          </Button>
        )}
      </div>
    </div>
  );
}
