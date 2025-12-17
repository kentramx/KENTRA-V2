import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { getPlanTier, PLAN_TIER_CONFIG } from '@/config/planTierConfig';

export function PlanBadge() {
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
    return <Skeleton className="h-6 w-16 rounded-full" />;
  }

  if (!hasSubscription) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link to="/pricing-agente">
            <Badge variant="outline" className="cursor-pointer hover:bg-muted">
              Sin Plan
            </Badge>
          </Link>
        </TooltipTrigger>
        <TooltipContent>
          <p>Contrata un plan para publicar propiedades</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Usar config centralizado para obtener icono según tier
  const planName = subscription?.plan?.name || '';
  const planTier = getPlanTier(planName);
  const tierConfig = PLAN_TIER_CONFIG[planTier];
  const PlanIcon = tierConfig.icon;

  const getStatusConfig = () => {
    if (isSuspended) {
      return {
        variant: 'destructive' as const,
        icon: AlertTriangle,
        tooltip: 'Cuenta suspendida - Actualiza tu pago',
        showAlert: true,
      };
    }
    if (isPastDue) {
      return {
        variant: 'destructive' as const,
        icon: AlertTriangle,
        tooltip: 'Pago pendiente - Actualiza tu método de pago',
        showAlert: true,
      };
    }
    if (isTrial) {
      return {
        variant: 'secondary' as const,
        icon: PLAN_TIER_CONFIG.trial.icon,
        tooltip: `Trial - ${trialDaysRemaining} días restantes`,
        showAlert: trialDaysRemaining !== null && trialDaysRemaining <= 3,
      };
    }
    return {
      variant: 'default' as const,
      icon: PlanIcon,
      tooltip: `${subscription?.plan?.display_name} - ${limits.currentProperties}/${limits.maxProperties} propiedades`,
      showAlert: false,
    };
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  // Get short plan name for badge display
  const getShortPlanName = () => {
    if (isTrial) return 'Trial';
    const displayName = subscription?.plan?.display_name || '';
    // Get the last word of the plan name (e.g., "Starter", "Pro", "Elite")
    const parts = displayName.split(' ');
    return parts[parts.length - 1] || displayName;
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link to="/panel-agente?tab=subscription">
          <Badge 
            variant={config.variant}
            className={cn(
              'cursor-pointer gap-1 transition-all hover:scale-105',
              config.showAlert && 'animate-pulse'
            )}
          >
            <Icon className="h-3 w-3" />
            <span className="hidden sm:inline">
              {getShortPlanName()}
            </span>
            {isTrial && trialDaysRemaining !== null && (
              <span className="text-xs opacity-80">({trialDaysRemaining}d)</span>
            )}
          </Badge>
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        <p>{config.tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}
