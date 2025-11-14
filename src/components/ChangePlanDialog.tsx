import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, TrendingUp, TrendingDown, Check, AlertCircle, Calculator, Info } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

interface ChangePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlanId: string;
  currentPlanName: string;
  currentBillingCycle: string;
  userId: string;
  onSuccess: () => void;
}

interface Plan {
  id: string;
  name: string;
  display_name: string;
  price_monthly: number;
  price_yearly: number;
  features: {
    max_properties: number;
    featured_listings: number;
    max_agents?: number;
    analytics?: string;
    support?: string;
    [key: string]: any;
  };
}

interface ProrationPreview {
  proratedAmount: number;
  proratedCurrency: string;
  isUpgrade: boolean;
  isDowngrade: boolean;
  currentPrice: number;
  newPrice: number;
  nextBillingDate: string;
}

interface CooldownInfo {
  canChange: boolean;
  daysRemaining?: number;
  nextChangeDate?: string;
  lastChangeDate?: string;
}

interface UserRole {
  isAdmin: boolean;
  role: string;
}

export const ChangePlanDialog = ({
  open,
  onOpenChange,
  currentPlanId,
  currentPlanName,
  currentBillingCycle,
  userId,
  onSuccess,
}: ChangePlanDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>(
    currentBillingCycle as 'monthly' | 'yearly'
  );
  const [preview, setPreview] = useState<ProrationPreview | null>(null);
  const [cooldownInfo, setCooldownInfo] = useState<CooldownInfo>({ canChange: true });
  const [userRole, setUserRole] = useState<UserRole>({ isAdmin: false, role: 'buyer' });
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('active');

  useEffect(() => {
    if (open) {
      checkSubscriptionStatus();
      fetchAvailablePlans();
      checkUserRole();
      checkCooldown();
    }
  }, [open, currentPlanName]);

  const checkSubscriptionStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('status')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      
      if (data) {
        setSubscriptionStatus(data.status);
        
        // If subscription is canceled or expired, close dialog and show message
        if (data.status === 'canceled' || data.status === 'expired') {
          toast({
            title: 'Suscripción no activa',
            description: `Tu suscripción está ${data.status === 'canceled' ? 'cancelada' : 'expirada'}. Debes reactivar tu suscripción antes de cambiar de plan.`,
            variant: 'destructive',
          });
          onOpenChange(false);
        }
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
    }
  };

  const checkUserRole = async () => {
    try {
      // Check for impersonation first
      const IMPERSONATION_KEY = 'kentra_impersonated_role';
      const impersonatedRole = localStorage.getItem(IMPERSONATION_KEY);
      
      if (impersonatedRole) {
        // Verify user is actually super admin
        const { data: isSuperData } = await (supabase.rpc as any)('is_super_admin', {
          _user_id: userId,
        });

        if (isSuperData) {
          setUserRole({
            isAdmin: impersonatedRole === 'super_admin' || impersonatedRole === 'moderator',
            role: impersonatedRole,
          });
          return;
        }
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      setUserRole({
        isAdmin: data.role === 'super_admin' || data.role === 'moderator',
        role: data.role,
      });
    } catch (error) {
      console.error('Error checking user role:', error);
      setUserRole({ isAdmin: false, role: 'buyer' });
    }
  };

  const checkCooldown = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_changes')
        .select('changed_at')
        .eq('user_id', userId)
        .order('changed_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const lastChangeDate = new Date(data[0].changed_at);
        const daysSinceLastChange = Math.floor(
          (Date.now() - lastChangeDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const cooldownDays = 30;

        if (daysSinceLastChange < cooldownDays) {
          const daysRemaining = cooldownDays - daysSinceLastChange;
          const nextChangeDate = new Date(lastChangeDate);
          nextChangeDate.setDate(nextChangeDate.getDate() + cooldownDays);

          setCooldownInfo({
            canChange: false,
            daysRemaining,
            nextChangeDate: nextChangeDate.toISOString(),
            lastChangeDate: lastChangeDate.toISOString(),
          });
          return;
        }
      }

      setCooldownInfo({ canChange: true });
    } catch (error) {
      console.error('Error checking cooldown:', error);
      setCooldownInfo({ canChange: true });
    }
  };

  const fetchAvailablePlans = async () => {
    try {
      setLoading(true);
      
      // Determinar el tipo de planes a mostrar según el plan actual
      const planType = currentPlanName.toLowerCase().includes('inmobiliaria') 
        ? 'inmobiliaria' 
        : 'agente';

      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .ilike('name', `%${planType}%`)
        .eq('is_active', true)
        .order('price_monthly', { ascending: true });

      if (error) throw error;

      setPlans(data as unknown as Plan[]);
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los planes disponibles',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProrationPreview = async (planId: string, cycle: 'monthly' | 'yearly') => {
    if (planId === currentPlanId && cycle === currentBillingCycle) {
      setPreview(null);
      return;
    }

    try {
      setLoadingPreview(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No hay sesión activa');
      }

      const response = await supabase.functions.invoke('change-subscription-plan', {
        body: {
          newPlanId: planId,
          billingCycle: cycle,
          previewOnly: true,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      // Check for errors in response
      if (response.error) {
        const errorBody = response.error.context?.body;
        
        // Handle SUBSCRIPTION_CANCELED explicitly
        if (errorBody?.error === 'SUBSCRIPTION_CANCELED') {
          toast({
            title: 'Suscripción no activa',
            description: errorBody?.message || 'Tu suscripción está cancelada. Debes reactivar tu suscripción antes de cambiar de plan.',
            variant: 'destructive',
          });
          onOpenChange(false);
          return;
        }
        
        // Other errors - log but don't crash
        console.error('Error en preview:', errorBody || response.error);
        setPreview(null);
        return;
      }

      setPreview(response.data);
    } catch (error: any) {
      // Catch any unexpected errors
      console.error('Error fetching preview:', error);
      
      // Check if it's a SUBSCRIPTION_CANCELED error that wasn't caught above
      if (error?.error === 'SUBSCRIPTION_CANCELED' || error?.message?.includes('SUBSCRIPTION_CANCELED')) {
        toast({
          title: 'Suscripción no activa',
          description: error?.message || 'Tu suscripción está cancelada. Debes reactivar tu suscripción antes de cambiar de plan.',
          variant: 'destructive',
        });
        onOpenChange(false);
        return;
      }
      
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    if (selectedPlanId && open) {
      fetchProrationPreview(selectedPlanId, billingCycle);
    }
  }, [selectedPlanId, billingCycle, open]);

  const handleChangePlan = async () => {
    // Check for simulation mode
    const IMPERSONATION_KEY = 'kentra_impersonated_role';
    const isSimulating = localStorage.getItem(IMPERSONATION_KEY) !== null;
    
    if (isSimulating) {
      toast({
        title: 'Modo de Simulación Activo',
        description: 'Esta acción no se puede ejecutar durante la simulación. Sal del modo de simulación para realizar cambios reales.',
        variant: 'default',
      });
      return;
    }

    if (!selectedPlanId) {
      toast({
        title: 'Error',
        description: 'Por favor selecciona un plan',
        variant: 'destructive',
      });
      return;
    }

    if (selectedPlanId === currentPlanId && billingCycle === currentBillingCycle) {
      toast({
        title: 'Sin cambios',
        description: 'Ya tienes este plan y ciclo de facturación',
      });
      return;
    }

    setProcessing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No hay sesión activa');
      }

      const response = await supabase.functions.invoke('change-subscription-plan', {
        body: {
          newPlanId: selectedPlanId,
          billingCycle: billingCycle,
          previewOnly: false,
          bypassCooldown: userRole.isAdmin && !cooldownInfo.canChange, // Admin can force change
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      // Validar que no sea el mismo plan
      if (selectedPlanId === currentPlanId && billingCycle === currentBillingCycle) {
        toast({
          title: 'Plan actual',
          description: 'Ya estás en este plan con este ciclo de facturación.',
          variant: 'destructive',
        });
        setProcessing(false);
        return;
      }

      // Check for errors in response
      if (response.error) {
        const errorBody = response.error.context?.body;
        
        // Handle SUBSCRIPTION_CANCELED explicitly
        if (errorBody?.error === 'SUBSCRIPTION_CANCELED') {
          toast({
            title: 'Suscripción no activa',
            description: errorBody?.message || 'Tu suscripción está cancelada. Debes reactivar tu suscripción antes de cambiar de plan.',
            variant: 'destructive',
          });
          onOpenChange(false);
          return;
        }
        
        // Handle COOLDOWN_ACTIVE explicitly
        if (errorBody?.error === 'COOLDOWN_ACTIVE') {
          toast({
            title: 'Cambio de plan no disponible',
            description: errorBody?.message || 'Debes esperar antes de cambiar de plan nuevamente',
            variant: 'destructive',
          });
          
          // Update cooldown info
          if (errorBody) {
            setCooldownInfo({
              canChange: false,
              daysRemaining: errorBody.daysRemaining,
              nextChangeDate: errorBody.nextChangeDate,
              lastChangeDate: errorBody.lastChangeDate,
            });
          }
          return;
        }
        
        // Other errors
        console.error('Error en cambio de plan:', errorBody || response.error);
        toast({
          title: 'Error al cambiar de plan',
          description: errorBody?.message || 'Hubo un problema al cambiar de plan. Intenta de nuevo más tarde.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: '¡Plan actualizado!',
        description: 'Tu plan se ha cambiado exitosamente. Los cambios se reflejarán en tu próxima factura.',
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error changing plan:', error);
      
      // Check if it's a known error type that should be handled gracefully
      if (error?.error === 'SUBSCRIPTION_CANCELED' || error?.message?.includes('SUBSCRIPTION_CANCELED')) {
        toast({
          title: 'Suscripción no activa',
          description: error?.message || 'Tu suscripción está cancelada. Debes reactivar tu suscripción antes de cambiar de plan.',
          variant: 'destructive',
        });
        onOpenChange(false);
        return;
      }
      
      if (error?.error === 'COOLDOWN_ACTIVE' || error?.message?.includes('COOLDOWN_ACTIVE')) {
        toast({
          title: 'Cambio de plan no disponible',
          description: error?.message || 'Debes esperar antes de cambiar de plan nuevamente',
          variant: 'destructive',
        });
        return;
      }
      
      // Generic error handling
      toast({
        title: 'Error al cambiar de plan',
        description: error instanceof Error ? error.message : 'Intenta de nuevo más tarde',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const getChangeType = (planId: string) => {
    const currentPlan = plans.find(p => p.id === currentPlanId);
    const newPlan = plans.find(p => p.id === planId);
    
    if (!currentPlan || !newPlan) return null;

    const currentPrice = currentBillingCycle === 'yearly' 
      ? currentPlan.price_yearly 
      : currentPlan.price_monthly;
    
    const newPrice = billingCycle === 'yearly' 
      ? newPlan.price_yearly 
      : newPlan.price_monthly;

    if (newPrice > currentPrice) return 'upgrade';
    if (newPrice < currentPrice) return 'downgrade';
    return 'change';
  };

  const getPlanPrice = (plan: Plan) => {
    return billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cambiar Plan de Suscripción</DialogTitle>
          <DialogDescription>
            Selecciona tu nuevo plan. Los cambios se aplicarán inmediatamente con prorrateo automático.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Admin Badge */}
            {userRole.isAdmin && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Badge className="bg-purple-600">
                    👑 Administrador
                  </Badge>
                  <span className="text-sm text-purple-900">
                    Puedes cambiar de plan sin restricciones
                  </span>
                </div>
              </div>
            )}

            {/* Cooldown Warning */}
            {!cooldownInfo.canChange && cooldownInfo.daysRemaining && !userRole.isAdmin && (
              <div className="p-4 bg-amber-50 border-2 border-amber-500 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-900">
                      Cambio de plan no disponible
                    </p>
                    <p className="text-sm text-amber-800 mt-1">
                      Debes esperar <strong>{cooldownInfo.daysRemaining} día{cooldownInfo.daysRemaining > 1 ? 's' : ''}</strong> antes 
                      de cambiar de plan nuevamente. Próximo cambio disponible el{' '}
                      <strong>
                        {format(new Date(cooldownInfo.nextChangeDate!), "d 'de' MMMM, yyyy", { locale: es })}
                      </strong>.
                    </p>
                    <p className="text-xs text-amber-700 mt-2">
                      Esta restricción previene cambios frecuentes y abuso del sistema de prorrateo.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Admin Override Notice */}
            {!cooldownInfo.canChange && cooldownInfo.daysRemaining && userRole.isAdmin && (
              <div className="p-4 bg-purple-50 border-2 border-purple-300 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-purple-900">
                      Período de cooldown detectado
                    </p>
                    <p className="text-sm text-purple-800 mt-1">
                      El último cambio fue hace <strong>{30 - cooldownInfo.daysRemaining} días</strong>. 
                      Como administrador, puedes forzar el cambio ahora saltando el período de espera.
                    </p>
                    <p className="text-xs text-purple-700 mt-2">
                      ⚠️ Este cambio quedará registrado en el log de auditoría.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {/* Billing Cycle Toggle */}
            <div className="flex items-center justify-center gap-4 p-4 bg-muted rounded-lg">
              <Label className="text-sm font-medium">Ciclo de facturación:</Label>
              <RadioGroup
                value={billingCycle}
                onValueChange={(value) => setBillingCycle(value as 'monthly' | 'yearly')}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="monthly" id="monthly" />
                  <Label htmlFor="monthly" className="cursor-pointer">Mensual</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yearly" id="yearly" />
            <Label htmlFor="yearly" className="cursor-pointer">
              Anual <Badge variant="secondary" className="ml-2">-17%</Badge>
            </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Plans List */}
            <RadioGroup value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <div className="space-y-3">
                {plans.map((plan) => {
                  const isCurrentPlan = plan.id === currentPlanId;
                  const changeType = getChangeType(plan.id);
                  const price = getPlanPrice(plan);

                  return (
                    <div
                      key={plan.id}
                      className={`relative flex items-start gap-4 p-4 border-2 rounded-lg transition-all cursor-pointer hover:border-primary/50 ${
                        selectedPlanId === plan.id ? 'border-primary bg-primary/5' : 'border-border'
                      } ${isCurrentPlan ? 'bg-muted' : ''}`}
                      onClick={() => setSelectedPlanId(plan.id)}
                    >
                      <RadioGroupItem value={plan.id} id={plan.id} className="mt-1" />
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Label htmlFor={plan.id} className="text-lg font-semibold cursor-pointer">
                            {plan.display_name}
                          </Label>
                          {isCurrentPlan && (
                            <Badge variant="outline" className="text-xs">
                              <Check className="h-3 w-3 mr-1" />
                              Plan Actual
                            </Badge>
                          )}
                          {!isCurrentPlan && changeType === 'upgrade' && (
                            <Badge className="bg-green-600 text-xs">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Upgrade
                            </Badge>
                          )}
                          {!isCurrentPlan && changeType === 'downgrade' && (
                            <Badge variant="secondary" className="text-xs">
                              <TrendingDown className="h-3 w-3 mr-1" />
                              Downgrade
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className="text-2xl font-bold">
                            ${price.toLocaleString('es-MX')} MXN
                          </span>
                          <span className="text-sm text-muted-foreground">
                            /{billingCycle === 'yearly' ? 'año' : 'mes'}
                          </span>
                        </div>

                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Incluye:</span>{' '}
                  {plan.features?.max_properties === -1 
                    ? 'Propiedades ilimitadas' 
                    : `${plan.features?.max_properties} propiedades activas`}
                  {plan.features?.featured_listings > 0 && 
                    `, ${plan.features.featured_listings} destacada${plan.features.featured_listings > 1 ? 's' : ''}`}
                </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </RadioGroup>

            {/* Proration Preview */}
            {selectedPlanId && selectedPlanId !== currentPlanId && (
              <div className="p-4 border-2 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="font-semibold text-lg mb-2">
                      Preview del cambio de plan
                    </p>
                    
          {preview && (
            <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg border-2 border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-blue-500 rounded-lg">
                  <Calculator className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-lg mb-1">
                    Preview del Cambio de Plan
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Cálculo de prorrateo basado en tiempo restante del período actual
                  </p>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Desglose Detallado */}
              <div className="space-y-3 mb-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Plan actual</span>
                  <span className="font-medium">
                    {plans.find(p => p.id === currentPlanId)?.display_name} - ${preview.currentPrice.toLocaleString('es-MX')} MXN
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Nuevo plan</span>
                  <span className="font-medium">
                    {plans.find(p => p.id === selectedPlanId)?.display_name} - ${preview.newPrice.toLocaleString('es-MX')} MXN
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Diferencia de precio</span>
                  <span className={`font-medium ${preview.isUpgrade ? 'text-green-600' : 'text-orange-600'}`}>
                    {preview.isUpgrade ? '+' : ''}{(preview.newPrice - preview.currentPrice).toLocaleString('es-MX')} MXN
                  </span>
                </div>

                <Separator />

                <div className="bg-white dark:bg-gray-900 p-3 rounded-lg">
                  <div className="flex justify-between items-center text-sm mb-2">
                    <span className="text-muted-foreground">Próxima renovación</span>
                    <span className="font-medium">
                      {format(new Date(preview.nextBillingDate), "d 'de' MMMM, yyyy", { locale: es })}
                    </span>
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    Stripe ajusta el precio según los días restantes de tu período actual
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Total a Pagar */}
              <div className="flex justify-between items-center p-4 bg-white dark:bg-gray-900 rounded-lg">
                <div>
                  <div className="font-semibold text-lg">Total a pagar hoy</div>
                  <div className="text-xs text-muted-foreground">
                    {preview.isUpgrade ? 'Upgrade con prorrateo' : 'Downgrade con crédito aplicado'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">
                    ${preview.proratedAmount.toLocaleString('es-MX', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })} {preview.proratedCurrency}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Calculado por Stripe
                  </div>
                </div>
              </div>

              {/* Info Box */}
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex gap-2">
                  <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-900 dark:text-blue-100">
                    <p className="font-medium mb-1">¿Por qué este monto?</p>
                    <p>
                      Stripe calcula el prorrateo considerando el tiempo restante de tu período actual.
                      {preview.isUpgrade && ' Pagas la diferencia proporcional hasta tu próxima renovación.'}
                      {preview.isDowngrade && ' Recibes un crédito por el tiempo restante que se aplica al nuevo plan.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
                  </div>
                </div>
              </div>
            )}

            {/* Proration Notice */}
            {!selectedPlanId || selectedPlanId === currentPlanId ? (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>💡 Prorrateo automático:</strong> Si cambias a un plan más caro, solo pagarás 
                  la diferencia prorrateada por el tiempo restante. Si cambias a un plan más económico, 
                  el crédito se aplicará a tu próxima factura.
                </p>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={processing}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleChangePlan}
            disabled={processing || !selectedPlanId || loading || (!cooldownInfo.canChange && !userRole.isAdmin)}
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Procesando...
              </>
            ) : (
              'Cambiar Plan'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
