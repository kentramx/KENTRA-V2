/**
 * PublicPlanBadge - Badge público visible para compradores
 * 
 * Muestra el tipo de usuario + tier del plan con íconos distintivos
 * Formato: [Ícono Tipo] [Tipo] [Tier] [Ícono Tier]
 * Ejemplo: 🏢 Inmobiliaria Grow 👑
 */

import { Badge } from "@/components/ui/badge";
import { 
  getPlanTier, 
  PLAN_TIER_CONFIG, 
  getUserTypeFromPlan, 
  USER_TYPE_CONFIG,
  getShortTierName
} from "@/config/planTierConfig";
import { cn } from "@/lib/utils";

interface PublicPlanBadgeProps {
  planName?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PublicPlanBadge({ planName, size = 'md', className }: PublicPlanBadgeProps) {
  if (!planName) return null;

  const tier = getPlanTier(planName);
  const tierConfig = PLAN_TIER_CONFIG[tier];
  const userType = getUserTypeFromPlan(planName);
  const userTypeConfig = USER_TYPE_CONFIG[userType];
  const tierName = getShortTierName(planName);
  
  const TierIcon = tierConfig.icon;
  const TypeIcon = userTypeConfig.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  return (
    <Badge 
      className={cn(
        "flex items-center font-medium border-0 shadow-sm",
        tierConfig.badge,
        sizeClasses[size],
        className
      )}
    >
      <TypeIcon className={iconSizes[size]} />
      <span>{userTypeConfig.labelShort}</span>
      <span>{tierName}</span>
      <TierIcon className={iconSizes[size]} />
    </Badge>
  );
}

export default PublicPlanBadge;
