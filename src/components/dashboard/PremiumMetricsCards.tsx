import { Home, Star, CheckCircle, Calendar, TrendingUp, AlertTriangle } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import type { SubscriptionInfo } from '@/types/subscription';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PremiumMetricsCardsProps {
  subscriptionInfo: SubscriptionInfo | null;
  activePropertiesCount: number;
  featuredCount: number;
}

// Progress Ring Component
const ProgressRing = ({ 
  progress, 
  size = 48, 
  strokeWidth = 4,
  color = 'primary'
}: { 
  progress: number; 
  size?: number; 
  strokeWidth?: number;
  color?: 'primary' | 'accent' | 'warning' | 'success';
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference;

  const colorClasses = {
    primary: 'stroke-primary',
    accent: 'stroke-accent',
    warning: 'stroke-amber-500',
    success: 'stroke-emerald-500',
  };

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/30"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className={`${colorClasses[color]} transition-all duration-500 ease-out`}
      />
    </svg>
  );
};

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
  const propertiesPercent = isUnlimited ? 100 : Math.min((activePropertiesCount / propertiesLimit) * 100, 100);
  const featuredPercent = isFeaturedUnlimited ? 100 : featuredLimit > 0 ? Math.min((featuredCount / featuredLimit) * 100, 100) : 0;
  
  // Determinar color según uso
  const getUsageColor = (percent: number): 'primary' | 'accent' | 'warning' | 'success' => {
    if (percent >= 90) return 'warning';
    if (percent >= 70) return 'accent';
    return 'primary';
  };

  const metrics = [
    {
      id: 'properties',
      icon: Home,
      label: 'Propiedades',
      value: isUnlimited ? 'Sin límite' : `${activePropertiesCount}/${propertiesLimit}`,
      subtext: isUnlimited ? 'Plan ilimitado' : `${propertiesLimit - activePropertiesCount} disponibles`,
      progress: propertiesPercent,
      color: getUsageColor(propertiesPercent),
      warning: propertiesPercent >= 90 && !isUnlimited,
      gradient: 'from-slate-500/10 to-slate-600/5',
      iconBg: 'bg-slate-500/10',
      iconColor: 'text-slate-600',
    },
    {
      id: 'featured',
      icon: Star,
      label: 'Destacadas',
      value: isFeaturedUnlimited ? 'Sin límite' : `${featuredCount}/${featuredLimit}`,
      subtext: isFeaturedUnlimited ? 'Plan ilimitado' : featuredLimit > 0 ? `${featuredLimit - featuredCount} disponibles` : 'No incluido',
      progress: featuredPercent,
      color: 'accent' as const,
      warning: featuredPercent >= 90 && !isFeaturedUnlimited,
      gradient: 'from-amber-500/10 to-yellow-500/5',
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-600',
    },
    {
      id: 'active',
      icon: CheckCircle,
      label: 'Activas',
      value: `${activePropertiesCount}`,
      subtext: 'Propiedades publicadas',
      progress: 100,
      color: 'success' as const,
      warning: false,
      gradient: 'from-emerald-500/10 to-green-500/5',
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-600',
    },
    {
      id: 'renewal',
      icon: Calendar,
      label: 'Renovación',
      value: daysUntilRenewal !== null
        ? daysUntilRenewal > 0
          ? `${daysUntilRenewal} días`
          : 'Vencido'
        : 'N/A',
      subtext: daysUntilRenewal !== null && daysUntilRenewal > 0 
        ? 'Próximo cobro' 
        : daysUntilRenewal === 0 
          ? 'Hoy' 
          : 'Sin suscripción',
      progress: daysUntilRenewal !== null ? Math.max(0, Math.min(100, (daysUntilRenewal / 30) * 100)) : 0,
      color: daysUntilRenewal !== null && daysUntilRenewal <= 5 ? 'warning' as const : 'primary' as const,
      warning: daysUntilRenewal !== null && daysUntilRenewal <= 5,
      gradient: 'from-blue-500/10 to-indigo-500/5',
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-600',
    },
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          
          return (
            <Tooltip key={metric.id}>
              <TooltipTrigger asChild>
                <div
                  className={`group relative overflow-hidden rounded-xl bg-gradient-to-br ${metric.gradient} border border-border/50 p-4 md:p-5 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 cursor-default`}
                >
                  {/* Warning indicator */}
                  {metric.warning && (
                    <div className="absolute top-2 right-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
                    </div>
                  )}
                  
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs md:text-sm text-muted-foreground mb-1 truncate">
                        {metric.label}
                      </p>
                      <p className="text-lg md:text-2xl font-bold text-foreground truncate">
                        {metric.value}
                      </p>
                      <p className="text-[10px] md:text-xs text-muted-foreground/70 mt-1 truncate">
                        {metric.subtext}
                      </p>
                    </div>
                    
                    {/* Progress Ring with Icon */}
                    <div className="relative flex-shrink-0">
                      <ProgressRing 
                        progress={metric.progress} 
                        size={48} 
                        strokeWidth={3}
                        color={metric.color}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className={`w-8 h-8 rounded-full ${metric.iconBg} flex items-center justify-center`}>
                          <Icon className={`w-4 h-4 ${metric.iconColor}`} />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Hover effect line */}
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-sm">{metric.label}: {metric.value}</p>
                <p className="text-xs text-muted-foreground">{metric.subtext}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
};
