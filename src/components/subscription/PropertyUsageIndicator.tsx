import { useSubscription } from '@/contexts/SubscriptionContext';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PropertyUsageIndicatorProps {
  className?: string;
  showProgress?: boolean;
}

export function PropertyUsageIndicator({ 
  className,
  showProgress = true,
}: PropertyUsageIndicatorProps) {
  const { limits, isActive, isLoading } = useSubscription();

  if (isLoading || !isActive) return null;

  const { currentProperties, maxProperties, remainingProperties, usagePercent, isAtLimit, isNearLimit } = limits;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Propiedades</span>
        <div className="flex items-center gap-2">
          <span className={cn(
            'font-medium',
            isAtLimit && 'text-destructive',
            isNearLimit && !isAtLimit && 'text-yellow-600'
          )}>
            {currentProperties} / {maxProperties}
          </span>
          {isAtLimit && (
            <Badge variant="destructive" className="text-xs">
              Límite
            </Badge>
          )}
          {isNearLimit && !isAtLimit && (
            <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
              {remainingProperties} restantes
            </Badge>
          )}
        </div>
      </div>
      
      {showProgress && (
        <Progress 
          value={usagePercent} 
          className={cn(
            'h-1.5',
            isAtLimit && '[&>div]:bg-destructive',
            isNearLimit && !isAtLimit && '[&>div]:bg-yellow-500'
          )}
        />
      )}
    </div>
  );
}
