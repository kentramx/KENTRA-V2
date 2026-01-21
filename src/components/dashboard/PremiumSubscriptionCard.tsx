import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle,
  ArrowUpRight,
  CreditCard,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { differenceInDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getPlanTier, PLAN_TIER_CONFIG, METRIC_ICONS } from '@/config/planTierConfig';

interface SubscriptionInfo {
  plan_type?: string;
  status?: string;
  listing_limit?: number;
  featured_limit?: number;
  trial_ends_at?: string;
  current_period_end?: string;
}

interface PremiumSubscriptionCardProps {
  subscriptionInfo: SubscriptionInfo;
  userRole?: string;
  activePropertiesCount: number;
  featuredCount: number;
  onManage: () => void;
}

export const PremiumSubscriptionCard = ({
  subscriptionInfo,
  userRole = 'agent',
  activePropertiesCount,
  featuredCount,
  onManage,
}: PremiumSubscriptionCardProps) => {
  const navigate = useNavigate();

  // Usar config centralizado
  const planTier = useMemo(() => {
    const name = subscriptionInfo?.plan_name || subscriptionInfo?.display_name;
    if (!name) return 'none';
    return getPlanTier(name);
  }, [subscriptionInfo?.plan_name, subscriptionInfo?.display_name]);

  const config = PLAN_TIER_CONFIG[planTier];
  const TierIcon = config.icon;

  // Metric icons
  const HomeIcon = METRIC_ICONS.properties;
  const FeaturedIcon = METRIC_ICONS.featured;
  const CalendarIcon = METRIC_ICONS.renewal;
  const TrialIcon = PLAN_TIER_CONFIG.trial.icon;

  // Calcular días restantes
  const daysRemaining = subscriptionInfo?.current_period_end
    ? differenceInDays(new Date(subscriptionInfo.current_period_end), new Date())
    : null;

  // Calcular uso
  const propertiesLimit = subscriptionInfo?.properties_limit || 0;
  const featuredLimit = subscriptionInfo?.featured_limit || 0;
  const isUnlimited = propertiesLimit === -1;
  const propertiesUsage = isUnlimited ? 0 : propertiesLimit > 0 ? (activePropertiesCount / propertiesLimit) * 100 : 0;

  // Status del plan
  const status = subscriptionInfo?.status;
  const isPastDue = status === 'past_due';
  const isCanceled = status === 'canceled';
  const isTrial = status === 'trialing' || planTier === 'trial';
  const isActive = status === 'active';

  // Ruta de pricing según rol
  const pricingRoute = userRole === 'agency' 
    ? '/pricing-inmobiliaria' 
    : userRole === 'developer' 
      ? '/pricing-desarrolladora' 
      : '/pricing-agente';

  if (!subscriptionInfo) {
    const noSubConfig = PLAN_TIER_CONFIG.none;
    const NoSubIcon = noSubConfig.icon;
    
    return (
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${noSubConfig.gradient} border-2 ${noSubConfig.border} p-6 shadow-lg h-full`}>
        <div className="flex flex-col items-center text-center py-6">
          <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-5">
            <NoSubIcon className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">Sin Suscripción</h3>
          <p className="text-muted-foreground mb-6 max-w-[200px]">
            Contrata un plan para publicar propiedades
          </p>
          <Button 
            onClick={() => navigate(pricingRoute)}
            size="lg"
            className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white font-bold shadow-lg"
          >
            <Zap className="w-5 h-5 mr-2" />
            Ver Planes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${config.gradient} border-2 ${config.border} p-5 md:p-6 shadow-lg transition-all duration-300 hover:shadow-xl h-full flex flex-col`}>
      {/* Header */}
      <div className="flex items-start gap-4 mb-5">
        <div className={`w-14 h-14 rounded-xl ${config.iconBg} flex items-center justify-center flex-shrink-0`}>
          <TierIcon className={`w-7 h-7 ${config.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-bold text-foreground truncate">
              {subscriptionInfo.display_name || subscriptionInfo.plan_name || 'Mi Plan'}
            </h3>
          </div>
          <Badge className={`${config.badge} text-xs px-2.5 py-1 font-semibold`}>
            {isTrial ? 'Prueba Gratuita' : isActive ? 'Activo' : isPastDue ? 'Pago Pendiente' : isCanceled ? 'Cancelado' : 'Activo'}
          </Badge>
        </div>
      </div>

      {/* Trial/Past Due Alert */}
      {(isTrial || isPastDue) && daysRemaining !== null && (
        <div className={`mb-4 p-3 rounded-xl ${isPastDue ? 'bg-red-100 border border-red-200' : 'bg-blue-100 border border-blue-200'}`}>
          <div className="flex items-center gap-2">
            {isPastDue ? (
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            ) : (
              <TrialIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />
            )}
            <span className={`text-sm font-semibold ${isPastDue ? 'text-red-700' : 'text-blue-700'}`}>
              {isPastDue 
                ? 'Actualiza tu método de pago'
                : `${daysRemaining} días restantes de prueba`
              }
            </span>
          </div>
        </div>
      )}

      {/* Usage Stats */}
      <div className="space-y-4 mb-5 flex-1">
        <div className="bg-card/60 rounded-xl p-4 border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <HomeIcon className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Propiedades</span>
            </div>
            <span className={`text-sm font-bold ${config.accent}`}>
              {isUnlimited ? `${activePropertiesCount} / ∞` : `${activePropertiesCount} / ${propertiesLimit}`}
            </span>
          </div>
          <Progress 
            value={isUnlimited ? 30 : propertiesUsage} 
            className="h-2.5"
          />
          {!isUnlimited && propertiesUsage >= 80 && (
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1 font-medium">
              <AlertTriangle className="w-3.5 h-3.5" />
              {propertiesUsage >= 100 ? 'Límite alcanzado' : 'Cerca del límite'}
            </p>
          )}
        </div>

        <div className="bg-card/60 rounded-xl p-4 border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FeaturedIcon className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-foreground">Destacadas</span>
            </div>
            <span className={`text-sm font-bold ${config.accent}`}>
              {featuredLimit === -1 ? `${featuredCount} / ∞` : `${featuredCount} / ${featuredLimit}`}
            </span>
          </div>
          <Progress 
            value={featuredLimit === -1 ? 30 : featuredLimit > 0 ? (featuredCount / featuredLimit) * 100 : 0} 
            className="h-2.5"
          />
        </div>
      </div>

      {/* Renewal Info */}
      {subscriptionInfo.current_period_end && !isCanceled && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 pb-4 border-b border-border/50">
          <CalendarIcon className="w-4 h-4 flex-shrink-0" />
          <span>
            {isTrial ? 'Termina' : 'Renovación'}:{' '}
            <span className="font-semibold text-foreground">
              {format(new Date(subscriptionInfo.current_period_end), "d 'de' MMMM, yyyy", { locale: es })}
            </span>
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onManage}
          className="flex-1 h-11 border-border hover:bg-muted font-medium"
        >
          <CreditCard className="w-4 h-4 mr-2" />
          Administrar
        </Button>
        {(planTier === 'basic' || planTier === 'trial' || planTier === 'pro') && (
          <Button 
            size="sm" 
            onClick={() => navigate(pricingRoute)}
            className="flex-1 h-11 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white font-medium"
          >
            <ArrowUpRight className="w-4 h-4 mr-2" />
            Mejorar
          </Button>
        )}
      </div>
    </div>
  );
};
