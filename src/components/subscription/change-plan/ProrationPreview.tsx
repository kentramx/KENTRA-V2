import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Receipt, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { ProrationPreviewData, ChangeType, SubscriptionPlan, BillingCycle } from './types';

interface ProrationPreviewProps {
  preview: ProrationPreviewData | null;
  loading: boolean;
  error: string | null;
  changeType: ChangeType;
  plans: SubscriptionPlan[];
  currentPlanId: string;
  selectedPlanId: string | null;
  billingCycle: BillingCycle;
}

export function ProrationPreview({
  preview,
  loading,
  error,
  changeType,
  plans,
  currentPlanId,
  selectedPlanId,
  billingCycle,
}: ProrationPreviewProps) {
  if (loading) {
    return (
      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            Calculando cambio...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-8 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mt-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!preview || !selectedPlanId) {
    return null;
  }

  const currentPlan = plans.find(p => p.id === currentPlanId);
  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  
  if (!currentPlan || !selectedPlan) return null;

  const getPrice = (plan: SubscriptionPlan) => {
    return billingCycle === 'yearly' 
      ? (plan.price_yearly || plan.price_monthly * 12)
      : plan.price_monthly;
  };

  const currentPrice = getPrice(currentPlan);
  const newPrice = getPrice(selectedPlan);
  const difference = newPrice - currentPrice;

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          {changeType === 'upgrade' ? (
            <>
              <TrendingUp className="w-4 h-4 text-green-600" />
              Resumen del Upgrade
            </>
          ) : changeType === 'downgrade' ? (
            <>
              <TrendingDown className="w-4 h-4 text-orange-600" />
              Resumen del Downgrade
            </>
          ) : (
            <>
              <Receipt className="w-4 h-4" />
              Resumen del Cambio
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Plan actual ({currentPlan.display_name})</span>
            <span>${currentPrice.toLocaleString('es-MX')}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Nuevo plan ({selectedPlan.display_name})</span>
            <span>${newPrice.toLocaleString('es-MX')}</span>
          </div>
        </div>

        <div className="border-t pt-3">
          <div className="flex justify-between items-center">
            <span className="font-medium">
              {changeType === 'upgrade' ? 'Diferencia a pagar:' : 'Ajuste:'}
            </span>
            <span className={`text-xl font-bold ${difference > 0 ? 'text-primary' : 'text-green-600'}`}>
              {difference > 0 ? '+' : ''}${difference.toLocaleString('es-MX')} MXN
            </span>
          </div>
        </div>

        {changeType === 'upgrade' && preview.immediate_charge > 0 && (
          <p className="text-xs text-muted-foreground">
            Se cobrará ${(preview.immediate_charge / 100).toLocaleString('es-MX')} MXN de forma prorrateada a tu método de pago actual.
          </p>
        )}

        {changeType === 'downgrade' && (
          <p className="text-xs text-muted-foreground">
            El cambio se aplicará al final de tu período de facturación actual.
            {preview.credit_amount > 0 && ` Recibirás un crédito de $${(preview.credit_amount / 100).toLocaleString('es-MX')} MXN.`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
