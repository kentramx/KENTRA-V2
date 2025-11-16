import { Home, Star, CheckCircle, Calendar } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import type { SubscriptionInfo } from '@/types/subscription';

interface PlanMetricsCardsProps {
  subscriptionInfo: SubscriptionInfo | null;
  activePropertiesCount: number;
  featuredCount: number;
}

export const PlanMetricsCards = ({
  subscriptionInfo,
  activePropertiesCount,
  featuredCount,
}: PlanMetricsCardsProps) => {
  // Calcular días hasta renovación
  const daysUntilRenewal = subscriptionInfo?.current_period_end
    ? differenceInDays(new Date(subscriptionInfo.current_period_end), new Date())
    : null;

  // Obtener límites del plan
  const propertiesLimit = subscriptionInfo?.properties_limit || 1;
  const featuredLimit = subscriptionInfo?.featured_limit || 0;
  const isUnlimited = propertiesLimit === -1;

  const metrics = [
    {
      icon: Home,
      label: 'Propiedades disponibles',
      value: isUnlimited
        ? 'Sin límite'
        : `${activePropertiesCount} de ${propertiesLimit} usadas`,
      bgColor: 'bg-slate-50',
      iconBg: 'bg-slate-200',
      iconColor: 'text-slate-700',
    },
    {
      icon: Star,
      label: 'Destacadas disponibles',
      value: featuredLimit === -1
        ? 'Sin límite'
        : `${featuredCount} de ${featuredLimit} usadas`,
      bgColor: 'bg-purple-50',
      iconBg: 'bg-purple-200',
      iconColor: 'text-purple-700',
    },
    {
      icon: CheckCircle,
      label: 'Activas actualmente',
      value: `${activePropertiesCount} propiedades`,
      bgColor: 'bg-green-50',
      iconBg: 'bg-green-200',
      iconColor: 'text-green-700',
    },
    {
      icon: Calendar,
      label: 'Próxima renovación',
      value: daysUntilRenewal !== null
        ? daysUntilRenewal > 0
          ? `${daysUntilRenewal} días`
          : 'Vencido'
        : 'No aplica',
      bgColor: 'bg-orange-50',
      iconBg: 'bg-orange-200',
      iconColor: 'text-orange-700',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {metrics.map((metric, index) => (
        <div
          key={index}
          className={`${metric.bgColor} rounded-xl p-6 transition-all hover:shadow-md`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-2">{metric.label}</p>
              <p className="text-2xl font-bold text-foreground">{metric.value}</p>
            </div>
            <div className={`${metric.iconBg} rounded-full p-3`}>
              <metric.icon className={`h-6 w-6 ${metric.iconColor}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
