import { Home, Star, CheckCircle, Calendar, AlertTriangle } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import type { SubscriptionInfo } from '@/types/subscription';

interface PremiumMetricsCardsProps {
  subscriptionInfo: SubscriptionInfo | null;
  activePropertiesCount: number;
  featuredCount: number;
}

export const PremiumMetricsCards = ({
  subscriptionInfo,
  activePropertiesCount,
  featuredCount,
}: PremiumMetricsCardsProps) => {
  // Calcular días hasta renovación
  const daysUntilRenewal = subscriptionInfo?.current_period_end
    ? differenceInDays(new Date(subscriptionInfo.current_period_end), new Date())
    : null;

  // Obtener límites del plan
  const propertiesLimit = subscriptionInfo?.properties_limit || 1;
  const featuredLimit = subscriptionInfo?.featured_limit || 0;
  const isUnlimited = propertiesLimit === -1;
  const isFeaturedUnlimited = featuredLimit === -1;

  // Calcular porcentajes
  const propertiesPercent = isUnlimited ? 0 : Math.min((activePropertiesCount / propertiesLimit) * 100, 100);
  const featuredPercent = isFeaturedUnlimited ? 0 : featuredLimit > 0 ? Math.min((featuredCount / featuredLimit) * 100, 100) : 0;

  const metrics = [
    {
      id: 'properties',
      icon: Home,
      label: 'Propiedades Publicadas',
      value: isUnlimited ? activePropertiesCount.toString() : `${activePropertiesCount}/${propertiesLimit}`,
      subtext: isUnlimited ? 'Sin límite' : `${Math.max(0, propertiesLimit - activePropertiesCount)} disponibles`,
      percent: propertiesPercent,
      warning: propertiesPercent >= 80 && !isUnlimited,
      bgColor: 'bg-gradient-to-br from-primary/10 via-primary/5 to-transparent',
      iconBg: 'bg-primary/15',
      iconColor: 'text-primary',
      borderColor: 'border-primary/20',
    },
    {
      id: 'featured',
      icon: Star,
      label: 'Destacadas del Mes',
      value: isFeaturedUnlimited ? featuredCount.toString() : `${featuredCount}/${featuredLimit}`,
      subtext: isFeaturedUnlimited ? 'Sin límite' : featuredLimit > 0 ? `${Math.max(0, featuredLimit - featuredCount)} disponibles` : 'No incluido',
      percent: featuredPercent,
      warning: featuredPercent >= 80 && !isFeaturedUnlimited,
      bgColor: 'bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent',
      iconBg: 'bg-amber-500/15',
      iconColor: 'text-amber-600',
      borderColor: 'border-amber-500/20',
    },
    {
      id: 'active',
      icon: CheckCircle,
      label: 'Activas Ahora',
      value: activePropertiesCount.toString(),
      subtext: 'Propiedades visibles',
      percent: 100,
      warning: false,
      bgColor: 'bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent',
      iconBg: 'bg-emerald-500/15',
      iconColor: 'text-emerald-600',
      borderColor: 'border-emerald-500/20',
    },
    {
      id: 'renewal',
      icon: Calendar,
      label: 'Próxima Renovación',
      value: daysUntilRenewal !== null
        ? daysUntilRenewal > 0
          ? `${daysUntilRenewal} días`
          : daysUntilRenewal === 0
            ? 'Hoy'
            : 'Vencido'
        : 'N/A',
      subtext: daysUntilRenewal !== null && daysUntilRenewal > 0 
        ? 'Hasta próximo cobro' 
        : daysUntilRenewal === 0 
          ? 'Se renueva hoy' 
          : 'Sin suscripción activa',
      percent: daysUntilRenewal !== null ? Math.max(0, Math.min(100, (daysUntilRenewal / 30) * 100)) : 0,
      warning: daysUntilRenewal !== null && daysUntilRenewal <= 5 && daysUntilRenewal >= 0,
      bgColor: 'bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent',
      iconBg: 'bg-blue-500/15',
      iconColor: 'text-blue-600',
      borderColor: 'border-blue-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        
        return (
          <div
            key={metric.id}
            className={`relative overflow-hidden rounded-xl ${metric.bgColor} border ${metric.borderColor} p-4 md:p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5`}
          >
            {/* Warning indicator */}
            {metric.warning && (
              <div className="absolute top-3 right-3">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
            )}
            
            {/* Icon */}
            <div className={`w-12 h-12 rounded-xl ${metric.iconBg} flex items-center justify-center mb-4`}>
              <Icon className={`w-6 h-6 ${metric.iconColor}`} />
            </div>
            
            {/* Content */}
            <div>
              <p className="text-xs md:text-sm text-muted-foreground mb-1 font-medium">
                {metric.label}
              </p>
              <p className="text-2xl md:text-3xl font-bold text-foreground leading-none mb-1">
                {metric.value}
              </p>
              <p className="text-xs text-muted-foreground">
                {metric.subtext}
              </p>
            </div>

            {/* Progress bar at bottom */}
            {metric.percent > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-border/30">
                <div 
                  className={`h-full transition-all duration-500 ${metric.warning ? 'bg-amber-500' : metric.iconColor.replace('text-', 'bg-')}`}
                  style={{ width: `${Math.min(metric.percent, 100)}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
