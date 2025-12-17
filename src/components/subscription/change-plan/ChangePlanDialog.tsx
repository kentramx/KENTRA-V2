import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getPricingRoute } from '@/utils/getPricingRoute';

import { BillingCycleToggle } from './BillingCycleToggle';
import { PlanSelector } from './PlanSelector';
import { ProrationPreview } from './ProrationPreview';
import { ConfirmChangeButton } from './ConfirmChangeButton';
import { PlanCardSkeleton } from '../SubscriptionSkeletons';
import {
  PlanFeatures,
  SubscriptionPlan, 
  ProrationPreviewData,
  BillingCycle,
  ChangeType,
  UserRole,
} from './types';

interface ChangePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlanId: string;
  currentPlanName: string;
  currentBillingCycle: string;
  userId: string;
  onSuccess: () => void;
}

export function ChangePlanDialog({
  open,
  onOpenChange,
  currentPlanId,
  currentPlanName,
  currentBillingCycle,
  userId,
  onSuccess,
}: ChangePlanDialogProps) {
  const navigate = useNavigate();
  
  // State
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>((currentBillingCycle as BillingCycle) || 'monthly');
  const [preview, setPreview] = useState<ProrationPreviewData | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('buyer');
  const [hasPendingCancellation, setHasPendingCancellation] = useState(false);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  
  // Loading states
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Derived state
  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const currentPlan = plans.find(p => p.id === currentPlanId);

  // Calculate change type
  const getChangeType = (): ChangeType => {
    if (!selectedPlan || !currentPlan) return null;
    if (selectedPlanId === currentPlanId && billingCycle !== currentBillingCycle) {
      return 'cycle_change';
    }
    
    const getPrice = (plan: SubscriptionPlan) => {
      return billingCycle === 'yearly' 
        ? (plan.price_yearly || plan.price_monthly * 12)
        : plan.price_monthly;
    };
    
    const currentPrice = getPrice(currentPlan);
    const newPrice = getPrice(selectedPlan);
    
    if (newPrice > currentPrice) return 'upgrade';
    if (newPrice < currentPrice) return 'downgrade';
    return null;
  };

  const changeType = getChangeType();

  // State for suspended status
  const [isSuspended, setIsSuspended] = useState(false);

  // Fetch user role and subscription status
  useEffect(() => {
    if (!open || !userId) return;

    const fetchUserData = async () => {
      try {
        // Fetch user role
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (roleData?.role) {
          setUserRole(roleData.role as UserRole);
        }

        // Check for pending cancellation, suspended status, and get current period end
        const { data: subData } = await supabase
          .from('user_subscriptions')
          .select('cancel_at_period_end, current_period_end, status')
          .eq('user_id', userId)
          .maybeSingle();
        
        setHasPendingCancellation(subData?.cancel_at_period_end || false);
        setCurrentPeriodEnd(subData?.current_period_end || null);
        setIsSuspended(subData?.status === 'suspended');
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, [open, userId]);

  // Fetch available plans
  useEffect(() => {
    if (!open) return;

    const fetchPlans = async () => {
      setLoadingPlans(true);
      try {
        // Determine plan type from current plan name
        const planType = currentPlanName.split('_')[0];
        
        const { data, error } = await supabase
          .from('subscription_plans')
          .select('*')
          .ilike('name', `${planType}_%`)
          .eq('is_active', true)
          .not('name', 'ilike', '%_trial')
          .order('price_monthly', { ascending: true });

        if (error) throw error;
        // Map database response to SubscriptionPlan type
        const mappedPlans: SubscriptionPlan[] = (data || []).map(p => ({
          id: p.id,
          name: p.name,
          display_name: p.display_name,
          price_monthly: p.price_monthly,
          price_yearly: p.price_yearly,
          features: p.features as PlanFeatures,
          is_active: p.is_active ?? true,
        }));
        setPlans(mappedPlans);
      } catch (error) {
        console.error('Error fetching plans:', error);
        toast.error('Error al cargar los planes disponibles');
      } finally {
        setLoadingPlans(false);
      }
    };

    fetchPlans();
  }, [open, currentPlanName]);

  // Fetch proration preview when selection changes
  useEffect(() => {
    if (!selectedPlanId || !open) {
      setPreview(null);
      return;
    }

    // Don't fetch preview if same plan and same cycle
    if (selectedPlanId === currentPlanId && billingCycle === currentBillingCycle) {
      setPreview(null);
      return;
    }

    const fetchPreview = async () => {
      setLoadingPreview(true);
      setPreviewError(null);
      
      try {
        const { data, error } = await supabase.functions.invoke('change-subscription-plan', {
          body: {
            newPlanId: selectedPlanId,
            billingCycle,
            previewOnly: true,
          },
        });

        if (error) throw error;
        
        // Handle trial users without Stripe subscription
        if (data?.error === 'TRIAL_NO_STRIPE') {
          toast.info('Para activar un plan de pago, serás redirigido a la página de checkout');
          onOpenChange(false);
          const planType = currentPlanName.split('_')[0];
          const pricingRoute = planType === 'agente' ? '/pricing-agente' 
            : planType === 'inmobiliaria' ? '/pricing-inmobiliaria'
            : planType === 'desarrolladora' ? '/pricing-desarrolladora'
            : '/pricing-agente';
          navigate(pricingRoute);
          return;
        }
        
        if (data?.error) {
          throw new Error(data.error);
        }

        setPreview(data.preview || null);
      } catch (error) {
        console.error('Error fetching preview:', error);
        setPreviewError(error instanceof Error ? error.message : 'Error al calcular el cambio');
      } finally {
        setLoadingPreview(false);
      }
    };

    const debounceTimer = setTimeout(fetchPreview, 300);
    return () => clearTimeout(debounceTimer);
  }, [selectedPlanId, billingCycle, open, currentPlanId, currentBillingCycle]);

  // Handle plan change confirmation
  const handleConfirmChange = async () => {
    if (!selectedPlanId) return;

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('change-subscription-plan', {
        body: {
          newPlanId: selectedPlanId,
          billingCycle,
          previewOnly: false,
        },
      });

      if (error) throw error;
      
      // Handle trial users without Stripe subscription
      if (data?.error === 'TRIAL_NO_STRIPE') {
        toast.info('Para activar este plan, serás redirigido a la página de checkout');
        onOpenChange(false);
        navigate(getPricingRoute(userRole, currentPlanName));
        return;
      }
      
      // Handle payment failures
      if (data?.error === 'PAYMENT_FAILED') {
        toast.error('Pago rechazado', {
          description: data.message || 'No se pudo procesar el pago. Por favor verifica tu método de pago.',
          duration: 8000,
        });
        return;
      }
      
      if (data?.error) throw new Error(data.error);

      toast.success(
        changeType === 'upgrade' 
          ? '¡Plan actualizado exitosamente!' 
          : changeType === 'downgrade'
            ? 'Plan cambiado. Se aplicará al final del período.'
            : 'Ciclo de facturación actualizado.'
      );

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error changing plan:', error);
      toast.error(error instanceof Error ? error.message : 'Error al cambiar el plan');
    } finally {
      setProcessing(false);
    }
  };

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedPlanId(null);
      setPreview(null);
      setPreviewError(null);
      setBillingCycle((currentBillingCycle as BillingCycle) || 'monthly');
    }
  }, [open, currentBillingCycle]);

  const canConfirm = selectedPlanId && 
    !loadingPreview && 
    !isSuspended &&
    (selectedPlanId !== currentPlanId || billingCycle !== currentBillingCycle);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cambiar de Plan</DialogTitle>
          <DialogDescription>
            Plan actual: <strong>{currentPlan?.display_name || currentPlanName}</strong> ({currentBillingCycle === 'yearly' ? 'Anual' : 'Mensual'})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Suspended Warning */}
          {isSuspended && (
            <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
              <p className="text-sm text-destructive font-medium">
                Tu suscripción está suspendida. Debes resolver el problema de pago antes de cambiar de plan.
              </p>
            </div>
          )}

          {/* Billing Cycle Toggle */}
          <BillingCycleToggle
            value={billingCycle}
            onChange={setBillingCycle}
            disabled={processing || isSuspended}
          />

          {/* Plan Selector */}
          {loadingPlans ? (
            <div className="space-y-3">
              <PlanCardSkeleton />
              <PlanCardSkeleton />
            </div>
          ) : (
            <PlanSelector
              plans={plans}
              selectedPlanId={selectedPlanId}
              currentPlanId={currentPlanId}
              billingCycle={billingCycle}
              onSelectPlan={setSelectedPlanId}
              disabled={processing || isSuspended}
              hasPendingCancellation={hasPendingCancellation}
            />
          )}

          {/* Proration Preview */}
          <ProrationPreview
            preview={preview}
            loading={loadingPreview}
            error={previewError}
            changeType={changeType}
            plans={plans}
            currentPlanId={currentPlanId}
            selectedPlanId={selectedPlanId}
            billingCycle={billingCycle}
            currentPeriodEnd={currentPeriodEnd}
          />

          {/* Confirm Button */}
          <ConfirmChangeButton
            onClick={handleConfirmChange}
            loading={processing}
            disabled={!canConfirm}
            changeType={changeType}
            selectedPlanName={selectedPlan?.display_name}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
