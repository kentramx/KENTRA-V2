import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { BillingCycle } from './types';

interface BillingCycleToggleProps {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
  disabled?: boolean;
  showSavings?: boolean;
  savingsPercent?: number;
}

export function BillingCycleToggle({
  value,
  onChange,
  disabled = false,
  showSavings = true,
  savingsPercent = 17,
}: BillingCycleToggleProps) {
  const isYearly = value === 'yearly';

  return (
    <div className="flex items-center justify-center gap-3 p-4 bg-muted/50 rounded-lg">
      <Label 
        htmlFor="billing-toggle" 
        className={`text-sm font-medium transition-colors ${!isYearly ? 'text-foreground' : 'text-muted-foreground'}`}
      >
        Mensual
      </Label>
      
      <Switch
        id="billing-toggle"
        checked={isYearly}
        onCheckedChange={(checked) => onChange(checked ? 'yearly' : 'monthly')}
        disabled={disabled}
      />
      
      <div className="flex items-center gap-2">
        <Label 
          htmlFor="billing-toggle" 
          className={`text-sm font-medium transition-colors ${isYearly ? 'text-foreground' : 'text-muted-foreground'}`}
        >
          Anual
        </Label>
        {showSavings && (
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs">
            Ahorra {savingsPercent}%
          </Badge>
        )}
      </div>
    </div>
  );
}
