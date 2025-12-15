import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Check, TrendingUp, TrendingDown } from 'lucide-react';
import { SubscriptionPlan, BillingCycle, PlanFeatures } from './types';
import { cn } from '@/lib/utils';

interface PlanSelectorProps {
  plans: SubscriptionPlan[];
  selectedPlanId: string | null;
  currentPlanId: string;
  billingCycle: BillingCycle;
  onSelectPlan: (planId: string) => void;
  disabled?: boolean;
  hasPendingCancellation?: boolean;
}

export function PlanSelector({
  plans,
  selectedPlanId,
  currentPlanId,
  billingCycle,
  onSelectPlan,
  disabled = false,
  hasPendingCancellation = false,
}: PlanSelectorProps) {
  const getPrice = (plan: SubscriptionPlan) => {
    return billingCycle === 'yearly' 
      ? (plan.price_yearly || plan.price_monthly * 12)
      : plan.price_monthly;
  };

  const getCurrentPlanPrice = () => {
    const currentPlan = plans.find(p => p.id === currentPlanId);
    return currentPlan ? getPrice(currentPlan) : 0;
  };

  const getPriceLabel = (plan: SubscriptionPlan) => {
    const price = getPrice(plan);
    const formattedPrice = price.toLocaleString('es-MX');
    return billingCycle === 'yearly' 
      ? `$${formattedPrice}/año`
      : `$${formattedPrice}/mes`;
  };

  const getChangeType = (plan: SubscriptionPlan): 'current' | 'upgrade' | 'downgrade' => {
    if (plan.id === currentPlanId) return 'current';
    const currentPrice = getCurrentPlanPrice();
    const newPrice = getPrice(plan);
    return newPrice > currentPrice ? 'upgrade' : 'downgrade';
  };

  const getFeaturesList = (features: PlanFeatures): string[] => {
    const list: string[] = [];
    if (features.max_properties !== undefined) {
      list.push(`${features.max_properties === -1 ? 'Ilimitadas' : features.max_properties} propiedades`);
    }
    if (features.featured_per_month) {
      list.push(`${features.featured_per_month} destacadas/mes`);
    }
    if (features.priority_support) {
      list.push('Soporte prioritario');
    }
    if (features.team_members) {
      list.push(`${features.team_members} miembros de equipo`);
    }
    return list.slice(0, 4);
  };

  // Filter out downgrades if there's a pending cancellation
  const filteredPlans = hasPendingCancellation
    ? plans.filter(plan => {
        const changeType = getChangeType(plan);
        return changeType !== 'downgrade';
      })
    : plans;

  return (
    <RadioGroup
      value={selectedPlanId || ''}
      onValueChange={onSelectPlan}
      disabled={disabled}
      className="grid gap-3"
    >
      {filteredPlans.map((plan) => {
        const changeType = getChangeType(plan);
        const isSelected = selectedPlanId === plan.id;
        const isCurrent = plan.id === currentPlanId;
        const features = getFeaturesList(plan.features as PlanFeatures);

        return (
          <Label key={plan.id} htmlFor={plan.id} className="cursor-pointer">
            <Card
              className={cn(
                'p-4 transition-all hover:border-primary/50',
                isSelected && 'border-primary ring-2 ring-primary/20',
                isCurrent && 'bg-muted/50',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className="flex items-start gap-3">
                <RadioGroupItem value={plan.id} id={plan.id} className="mt-1" />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{plan.display_name}</span>
                    
                    {isCurrent && (
                      <Badge variant="outline" className="text-xs">
                        Plan actual
                      </Badge>
                    )}
                    
                    {!isCurrent && changeType === 'upgrade' && (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        Upgrade
                      </Badge>
                    )}
                    
                    {!isCurrent && changeType === 'downgrade' && (
                      <Badge variant="secondary" className="text-xs">
                        <TrendingDown className="w-3 h-3 mr-1" />
                        Downgrade
                      </Badge>
                    )}
                  </div>
                  
                  <div className="text-lg font-bold text-primary mt-1">
                    {getPriceLabel(plan)}
                  </div>
                  
                  {features.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check className="w-3 h-3 text-green-600" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Card>
          </Label>
        );
      })}
    </RadioGroup>
  );
}
