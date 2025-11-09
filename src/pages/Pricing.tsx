import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { DynamicBreadcrumbs } from '@/components/DynamicBreadcrumbs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Check, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Plan {
  id: string;
  name: string;
  display_name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  features: any;
  is_popular?: boolean;
}

const Pricing = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isYearly, setIsYearly] = useState(false);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  const roleParam = searchParams.get('role');
  const actionParam = searchParams.get('action');

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los planes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (plan: Plan) => {
    if (!user) {
      navigate(`/auth?redirect=/pricing`);
      return;
    }

    setProcessingPlan(plan.id);

    try {
      // Plan gratuito - asignar directamente
      if (plan.name === 'free') {
        await supabase.from('user_roles').update({ role: 'buyer' }).eq('user_id', user.id);

        toast({
          title: '¡Plan activado!',
          description: 'Ya puedes publicar tu primera propiedad',
        });

        navigate('/panel-agente');
        return;
      }

      // Planes de pago - crear sesión de Stripe (TODO: implementar)
      toast({
        title: 'Próximamente',
        description: 'La integración con Stripe estará disponible pronto',
      });

      // TODO: Descomentar cuando Stripe esté configurado
      /*
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          planId: plan.id,
          billingCycle: isYearly ? 'yearly' : 'monthly',
          successUrl: `${window.location.origin}/panel-agente?payment=success`,
          cancelUrl: `${window.location.origin}/pricing?payment=canceled`,
        },
      });

      if (error) throw error;
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
      */
    } catch (error) {
      console.error('Error selecting plan:', error);
      toast({
        title: 'Error',
        description: 'Hubo un problema al procesar tu selección',
        variant: 'destructive',
      });
    } finally {
      setProcessingPlan(null);
    }
  };

  const getPlanPrice = (plan: Plan) => {
    if (plan.price_monthly === 0) return 'Gratis';
    return `$${plan.price_monthly.toLocaleString('es-MX')}/mes`;
  };

  const getYearlyPriceDisplay = (plan: Plan) => {
    if (plan.price_yearly === 0) return null;
    const monthlyEquivalent = Math.round(plan.price_yearly / 12);
    return {
      total: plan.price_yearly.toLocaleString('es-MX'),
      monthly: monthlyEquivalent.toLocaleString('es-MX')
    };
  };

  const getPlanSavings = (plan: Plan) => {
    if (plan.price_yearly === 0) return null;
    const monthlyCost = plan.price_monthly * 12;
    const savings = ((monthlyCost - plan.price_yearly) / monthlyCost) * 100;
    return savings > 0 ? Math.round(savings) : null;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // Marcar plan recomendado basado en el rol
  const enhancedPlans = plans.map((plan) => ({
    ...plan,
    is_popular:
      (roleParam === 'agent' && plan.name === 'basic') ||
      (roleParam === 'agency' && plan.name === 'enterprise'),
  }));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <DynamicBreadcrumbs
          items={[
            { label: 'Inicio', href: '/', active: false },
            { label: 'Planes y Precios', href: '', active: true },
          ]}
          className="mb-4"
        />

        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Elige el plan perfecto para ti
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              {actionParam === 'new_property'
                ? 'Selecciona un plan para comenzar a publicar propiedades'
                : 'Planes flexibles para cada tipo de usuario'}
            </p>

            {/* Toggle Mensual/Anual */}
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="flex items-center gap-4">
                <Label htmlFor="billing-toggle" className={!isYearly ? 'font-semibold' : ''}>
                  Mensual (sin compromiso)
                </Label>
                <Switch
                  id="billing-toggle"
                  checked={isYearly}
                  onCheckedChange={setIsYearly}
                />
                <Label htmlFor="billing-toggle" className={isYearly ? 'font-semibold' : ''}>
                  Ahorrar 12% (opcional)
                </Label>
              </div>
              <p className="text-sm text-muted-foreground max-w-md text-center">
                Puedes cancelar cuando quieras. El pago anual es opcional solo para quienes desean ahorrar.
              </p>
            </div>
          </div>

          {/* Cards de planes */}
          <div className="grid md:grid-cols-4 gap-6 mb-12">
            {enhancedPlans.map((plan) => {
              const features = plan.features || {};
              const yearlyDisplay = getYearlyPriceDisplay(plan);
              const savingsPercent = getPlanSavings(plan);

              return (
                <Card
                  key={plan.id}
                  className={`relative ${
                    plan.is_popular ? 'border-primary shadow-lg' : ''
                  }`}
                >
                  {plan.is_popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                      Recomendado
                    </Badge>
                  )}

                  <CardHeader>
                    <CardTitle className="text-2xl">{plan.display_name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                    <div className="mt-4">
                      {!isYearly ? (
                        <>
                          <div className="text-sm text-muted-foreground mb-1">Mensual:</div>
                          <div className="text-4xl font-bold text-foreground">
                            {getPlanPrice(plan)}
                          </div>
                        </>
                      ) : (
                        <>
                          {yearlyDisplay && (
                            <>
                              <div className="text-sm text-muted-foreground mb-1">
                                Pago adelantado para ahorrar:
                              </div>
                              <div className="text-3xl font-bold text-foreground">
                                ${yearlyDisplay.total}
                              </div>
                              <div className="text-sm text-muted-foreground mt-2">
                                (equivale a ${yearlyDisplay.monthly}/mes)
                              </div>
                              {savingsPercent && (
                                <Badge variant="secondary" className="mt-2">
                                  Ahorras {savingsPercent}%
                                </Badge>
                              )}
                            </>
                          )}
                          {!yearlyDisplay && (
                            <div className="text-4xl font-bold text-foreground">
                              {getPlanPrice(plan)}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm">
                          {features.max_properties === -1
                            ? 'Propiedades ilimitadas'
                            : `Hasta ${features.max_properties} ${
                                features.max_properties === 1 ? 'propiedad' : 'propiedades'
                              }`}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        {features.featured_listings > 0 ? (
                          <>
                            <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                            <span className="text-sm">
                              {features.featured_listings} propiedades destacadas
                            </span>
                          </>
                        ) : (
                          <>
                            <X className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-muted-foreground">
                              Sin propiedades destacadas
                            </span>
                          </>
                        )}
                      </li>
                      <li className="flex items-start gap-2">
                        {features.analytics ? (
                          <>
                            <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                            <span className="text-sm">Analytics avanzados</span>
                          </>
                        ) : (
                          <>
                            <X className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-muted-foreground">Sin analytics</span>
                          </>
                        )}
                      </li>
                      <li className="flex items-start gap-2">
                        {features.priority_support ? (
                          <>
                            <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                            <span className="text-sm">Soporte prioritario</span>
                          </>
                        ) : (
                          <>
                            <X className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-muted-foreground">Soporte básico</span>
                          </>
                        )}
                      </li>
                      {features.api_access && (
                        <li className="flex items-start gap-2">
                          <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                          <span className="text-sm">Acceso a API</span>
                        </li>
                      )}
                      {features.multi_agent && (
                        <li className="flex items-start gap-2">
                          <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                          <span className="text-sm">Multi-agente</span>
                        </li>
                      )}
                    </ul>
                  </CardContent>

                  <CardFooter>
                    <Button
                      className="w-full"
                      variant={plan.is_popular ? 'default' : 'outline'}
                      onClick={() => handleSelectPlan(plan)}
                      disabled={processingPlan === plan.id || !user}
                    >
                      {processingPlan === plan.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          {!user
                            ? 'Iniciar sesión'
                            : plan.name === 'free'
                            ? 'Comenzar gratis'
                            : 'Seleccionar plan'}
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          {/* FAQ Section */}
          <div className="max-w-3xl mx-auto mt-16">
            <h2 className="text-3xl font-bold text-center mb-8">Preguntas Frecuentes</h2>
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">¿Puedo cambiar de plan en cualquier momento?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Sí, puedes actualizar o degradar tu plan en cualquier momento. Los cambios se
                    aplicarán inmediatamente y se prorratearán en tu próxima factura.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">¿Qué pasa si cancelo mi suscripción?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Puedes cancelar en cualquier momento. Tendrás acceso a tu plan hasta el final
                    del período de facturación actual. Tus propiedades permanecerán activas pero no
                    podrás publicar nuevas.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">¿Ofrecen facturación?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Sí, emitimos facturas electrónicas automáticamente después de cada pago. Puedes
                    descargarlas desde tu panel de usuario.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Pricing;
