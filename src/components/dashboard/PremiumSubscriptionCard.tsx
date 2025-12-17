import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Crown, 
  Sparkles, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  ArrowUpRight,
  CreditCard,
  Calendar,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { differenceInDays, format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PremiumSubscriptionCardProps {
  subscriptionInfo: any;
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

  // Determinar tier del plan para estilos
  const planTier = useMemo(() => {
    if (!subscriptionInfo?.plan_name) return 'none';
    const lowerName = subscriptionInfo.plan_name.toLowerCase();
    if (lowerName.includes('elite') || lowerName.includes('premium')) return 'elite';
    if (lowerName.includes('pro') || lowerName.includes('profesional')) return 'pro';
    if (lowerName.includes('basico') || lowerName.includes('basic')) return 'basic';
    if (lowerName.includes('trial')) return 'trial';
    return 'basic';
  }, [subscriptionInfo?.plan_name]);

  // Estilos según tier
  const tierConfig = {
    elite: {
      gradient: 'from-amber-500/20 via-yellow-500/10 to-orange-500/20',
      border: 'border-amber-500/30',
      badge: 'bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-950',
      icon: Crown,
      glow: 'shadow-amber-500/10',
    },
    pro: {
      gradient: 'from-primary/20 via-accent/10 to-primary/20',
      border: 'border-primary/30',
      badge: 'bg-gradient-to-r from-primary to-accent text-primary-foreground',
      icon: Sparkles,
      glow: 'shadow-primary/10',
    },
    basic: {
      gradient: 'from-slate-500/10 via-gray-500/5 to-slate-500/10',
      border: 'border-border',
      badge: 'bg-secondary text-secondary-foreground',
      icon: CheckCircle,
      glow: '',
    },
    trial: {
      gradient: 'from-blue-500/10 via-indigo-500/5 to-blue-500/10',
      border: 'border-blue-500/30 border-dashed',
      badge: 'bg-blue-500 text-white',
      icon: Clock,
      glow: 'shadow-blue-500/10',
    },
    none: {
      gradient: 'from-muted/50 to-muted/30',
      border: 'border-border border-dashed',
      badge: 'bg-muted text-muted-foreground',
      icon: AlertTriangle,
      glow: '',
    },
  };

  const config = tierConfig[planTier];
  const TierIcon = config.icon;

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
    return (
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${config.gradient} border-2 ${config.border} p-6 ${config.glow} shadow-lg`}>
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Sin Suscripción Activa</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Contrata un plan para empezar a publicar tus propiedades
          </p>
          <Button 
            onClick={() => navigate(pricingRoute)}
            className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
          >
            <Zap className="w-4 h-4 mr-2" />
            Ver Planes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${config.gradient} border-2 ${config.border} p-5 md:p-6 ${config.glow} shadow-lg transition-all duration-300 hover:shadow-xl`}>
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
      
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl ${planTier === 'elite' ? 'bg-amber-500/20' : planTier === 'pro' ? 'bg-primary/20' : 'bg-muted'} flex items-center justify-center`}>
            <TierIcon className={`w-6 h-6 ${planTier === 'elite' ? 'text-amber-500' : planTier === 'pro' ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-foreground">
                {subscriptionInfo.display_name || subscriptionInfo.plan_name || 'Mi Plan'}
              </h3>
              <Badge className={`${config.badge} text-xs px-2 py-0.5`}>
                {isTrial ? 'Prueba' : isActive ? 'Activo' : isPastDue ? 'Pendiente' : isCanceled ? 'Cancelado' : 'Activo'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {subscriptionInfo.billing_cycle === 'yearly' ? 'Facturación anual' : 'Facturación mensual'}
            </p>
          </div>
        </div>
      </div>

      {/* Trial/Past Due Alert */}
      {(isTrial || isPastDue) && daysRemaining !== null && (
        <div className={`mb-4 p-3 rounded-lg ${isPastDue ? 'bg-destructive/10 border border-destructive/20' : 'bg-blue-500/10 border border-blue-500/20'}`}>
          <div className="flex items-center gap-2">
            {isPastDue ? (
              <AlertTriangle className="w-4 h-4 text-destructive" />
            ) : (
              <Clock className="w-4 h-4 text-blue-500" />
            )}
            <span className={`text-sm font-medium ${isPastDue ? 'text-destructive' : 'text-blue-600'}`}>
              {isPastDue 
                ? 'Pago pendiente - actualiza tu método de pago'
                : `${daysRemaining} días restantes de prueba`
              }
            </span>
          </div>
        </div>
      )}

      {/* Usage Stats */}
      <div className="space-y-3 mb-4">
        <div>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-muted-foreground">Propiedades</span>
            <span className="font-medium text-foreground">
              {isUnlimited ? `${activePropertiesCount} / ∞` : `${activePropertiesCount} / ${propertiesLimit}`}
            </span>
          </div>
          <Progress 
            value={isUnlimited ? 30 : propertiesUsage} 
            className="h-2"
          />
          {!isUnlimited && propertiesUsage >= 80 && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {propertiesUsage >= 100 ? 'Límite alcanzado' : 'Cerca del límite'}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-muted-foreground">Destacadas este mes</span>
            <span className="font-medium text-foreground">
              {featuredLimit === -1 ? `${featuredCount} / ∞` : `${featuredCount} / ${featuredLimit}`}
            </span>
          </div>
          <Progress 
            value={featuredLimit === -1 ? 30 : featuredLimit > 0 ? (featuredCount / featuredLimit) * 100 : 0} 
            className="h-2"
          />
        </div>
      </div>

      {/* Renewal Info */}
      {subscriptionInfo.current_period_end && !isCanceled && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 pb-4 border-b border-border/50">
          <Calendar className="w-4 h-4" />
          <span>
            {isTrial ? 'Prueba termina' : 'Próxima renovación'}:{' '}
            <span className="font-medium text-foreground">
              {format(new Date(subscriptionInfo.current_period_end), "d 'de' MMMM", { locale: es })}
            </span>
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onManage}
          className="flex-1 border-border/50 hover:bg-muted/50"
        >
          <CreditCard className="w-4 h-4 mr-2" />
          Administrar
        </Button>
        {(planTier === 'basic' || planTier === 'trial' || planTier === 'pro') && (
          <Button 
            size="sm" 
            onClick={() => navigate(pricingRoute)}
            className="flex-1 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
          >
            <ArrowUpRight className="w-4 h-4 mr-2" />
            Mejorar Plan
          </Button>
        )}
      </div>
    </div>
  );
};
