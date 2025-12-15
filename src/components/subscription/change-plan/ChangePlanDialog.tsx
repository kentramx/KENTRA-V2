import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

import { BillingCycleToggle } from './BillingCycleToggle';
import { CooldownWarning } from './CooldownWarning';
import { PlanSelector } from './PlanSelector';
import { ProrationPreview } from './ProrationPreview';
import { ConfirmChangeButton } from './ConfirmChangeButton';
import { PlanCardSkeleton } from '../SubscriptionSkeletons';
import {
  PlanFeatures,
  SubscriptionPlan, 
  ProrationPreviewData,
  BillingCycle,
  CooldownInfo,
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
  // State
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>((currentBillingCycle as BillingCycle) || 'monthly');
  const [preview, setPreview] = useState<ProrationPreviewData | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('buyer');
  const [hasPendingCancellation, setHasPendingCancellation] = useState(false);
  const [cooldownInfo, setCooldownInfo] = useState<CooldownInfo>({
    isInCooldown: false,
    lastChangeDate: null,
    daysRemaining: 0,
    canBypass: false,
  });
  
  // Loading states
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Derived state
  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const currentPlan = plans.find(p => p.id === currentPlanId);
  const isAdmin = userRole === 'moderator' || userRole === 'super_admin';
  

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

        // Check for pending cancellation
        const { data: subData } = await supabase
          .from('user_subscriptions')
          .select('cancel_at_period_end')
          .eq('user_id', userId)
          .maybeSingle();
        
        setHasPendingCancellation(subData?.cancel_at_period_end || false);

        // Check cooldown
        const { data: changeData } = await supabase
          .from('subscription_changes')
          .select('changed_at')
          .eq('user_id', userId)
          .order('changed_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (changeData?.changed_at) {
          const lastChange = new Date(changeData.changed_at);
          const daysSinceChange = Math.floor((Date.now() - lastChange.getTime()) / (1000 * 60 * 60 * 24));
          const cooldownDays = 30;
          
          if (daysSinceChange < cooldownDays) {
            setCooldownInfo({
              isInCooldown: true,
              lastChangeDate: changeData.changed_at,
              daysRemaining: cooldownDays - daysSinceChange,
              canBypass: roleData?.role === 'moderator' || roleData?.role === 'super_admin',
            });
          }
        }
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
        if (data?.error) {
          if (data.code === 'COOLDOWN_ACTIVE' && !isAdmin) {
            setCooldownInfo({
              isInCooldown: true,
              lastChangeDate: data.lastChangeDate,
              daysRemaining: data.daysRemaining,
              canBypass: false,
            });
          }
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
  }, [selectedPlanId, billingCycle, open, currentPlanId, currentBillingCycle, isAdmin]);

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
          adminBypass: isAdmin && cooldownInfo.isInCooldown,
        },
      });

      if (error) throw error;
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
    (!cooldownInfo.isInCooldown || isAdmin) &&
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
          {/* Cooldown Warning */}
          <CooldownWarning cooldownInfo={cooldownInfo} isAdmin={isAdmin} />

          {/* Billing Cycle Toggle */}
          <BillingCycleToggle
            value={billingCycle}
            onChange={setBillingCycle}
            disabled={processing || (cooldownInfo.isInCooldown && !isAdmin)}
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
              disabled={processing || (cooldownInfo.isInCooldown && !isAdmin)}
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
