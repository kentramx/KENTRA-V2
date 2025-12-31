import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { startSubscriptionCheckout, getCurrentSubscription } from '@/utils/stripeCheckout';
import { usePricingPlans, getPlanPropertyLimit, getPlanFeaturedLimit, getPlanMaxAgents, getMonthlyEquivalent } from '@/hooks/usePricingPlans';
import Navbar from '@/components/Navbar';
import { CouponInput } from '@/components/CouponInput';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Loader2 } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const PricingInmobiliaria = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState<{type: 'percent' | 'fixed', value: number} | null>(null);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  const { data: dbPlans, isLoading: plansLoading } = usePricingPlans('agency');

  // Find plans by name
  const startPlan = dbPlans?.find(p => p.name === 'inmobiliaria_start');
  const growPlan = dbPlans?.find(p => p.name === 'inmobiliaria_grow');
  const proPlan = dbPlans?.find(p => p.name === 'inmobiliaria_pro');

  // Helper to get features from DB or fallback
  const getFeatureList = (plan: any): string[] => {
    if (plan?.features?.feature_list && Array.isArray(plan.features.feature_list)) {
      return plan.features.feature_list.map((f: any) => f.text);
    }
    // Fallback
    const features: string[] = [];
    const limits = plan?.features?.limits || plan?.features || {};
    const caps = plan?.features?.capabilities || plan?.features || {};
    if (limits.max_properties) features.push(`Hasta ${limits.max_properties} propiedades activas`);
    if (limits.max_agents) features.push(`Hasta ${limits.max_agents} agentes en tu equipo`);
    if (limits.featured_per_month) features.push(`${limits.featured_per_month} propiedades destacadas al mes`);
    if (caps.priority_support) features.push('Soporte prioritario');
    if (caps.analytics) features.push('Analíticas avanzadas');
    return features;
  };

  const getDiscountedPrice = (basePrice: number) => {
    if (!appliedCoupon || !couponDiscount) {
      return { original: null, final: basePrice, savings: 0 };
    }
    
    let discountedPrice: number;
    let savings: number;
    
    if (couponDiscount.type === 'percent') {
      savings = basePrice * (couponDiscount.value / 100);
      discountedPrice = basePrice - savings;
    } else {
      savings = Math.min(couponDiscount.value, basePrice);
      discountedPrice = basePrice - savings;
    }
    
    return { 
      original: basePrice, 
      final: Math.max(0, Math.round(discountedPrice)),
      savings: Math.round(savings)
    };
  };

  const scrollToPlans = () => {
    const plansSection = document.getElementById('planes');
    plansSection?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSelectPlan = async (planSlug: string) => {
    if (processingPlan) return;
    
    if (!user) {
      navigate('/auth?redirect=/pricing-inmobiliaria');
      return;
    }

    setProcessingPlan(planSlug);
    try {
      // Verificar si ya tiene suscripción CON Stripe
      // Usuarios Trial (sin stripe_subscription_id) pueden continuar a checkout
      const { subscription } = await getCurrentSubscription();
      if (subscription && subscription.stripe_subscription_id) {
        toast.error('Ya tienes una suscripción activa. Ve a tu dashboard para gestionarla.');
        navigate('/panel-inmobiliaria');
        return;
      }

      // Buscar el plan completo para verificar si es trial (precio = 0)
      const fullPlanName = `inmobiliaria_${planSlug}`;
      const selectedPlan = dbPlans?.find(p => p.name === fullPlanName);
      const isTrialPlan = selectedPlan?.price_monthly === 0;

      if (isTrialPlan) {
        // Plan trial gratuito - usar start-trial directamente
        const { data, error } = await (await import('@/integrations/supabase/client')).supabase.functions.invoke('start-trial', {
          body: { planName: fullPlanName },
        });

        if (error || !data?.success) {
          toast.error(data?.error || 'Error al iniciar el período de prueba');
          return;
        }

        toast.success('¡Período de prueba activado!', {
          description: 'Ya puedes comenzar a usar Kentra.',
        });
        navigate('/panel-inmobiliaria');
        return;
      }

      // Iniciar checkout con el nuevo sistema (incluye cupón si está aplicado)
      const billingCycleValue = billingPeriod === 'monthly' ? 'monthly' : 'yearly';
      const result = await startSubscriptionCheckout(fullPlanName, billingCycleValue, appliedCoupon || undefined);

      if (!result.success) {
        toast.error(result.error || 'Error al iniciar el proceso de pago');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Ocurrió un error al procesar tu solicitud');
    } finally {
      setProcessingPlan(null);
    }
  };

  // Loading skeleton
  if (plansLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <Skeleton className="h-10 w-64 mx-auto mb-4" />
            <Skeleton className="h-6 w-96 mx-auto" />
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardHeader className="text-center">
                  <Skeleton className="h-6 w-32 mx-auto mb-2" />
                  <Skeleton className="h-10 w-40 mx-auto" />
                </CardHeader>
                <CardContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(j => (
                    <Skeleton key={j} className="h-4 w-full mb-3" />
                  ))}
                  <Skeleton className="h-10 w-full mt-4" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section - TIER S - Compact to show plans above fold */}
      <section className="container mx-auto px-4 py-12 md:py-16 text-center">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold mb-4" style={{ letterSpacing: '-0.025em' }}>Planes para Inmobiliarias</h1>
        <p className="text-muted-foreground text-lg md:text-xl max-w-3xl mx-auto mb-6">
          Gestiona tu equipo, administra tus propiedades y obtén mayor visibilidad.
        </p>
        <Button size="lg" onClick={scrollToPlans} className="h-12 px-6">
          Ver planes
        </Button>
      </section>

      {/* Intro Section - Compact */}
      <section className="container mx-auto px-4 py-10">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">
            Hecho para inmobiliarias que buscan crecer con tecnología.
          </h2>
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="flex items-start gap-3">
              <Check className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
              <p className="text-lg">Control total de tu inventario y tu equipo</p>
            </div>
            <div className="flex items-start gap-3">
              <Check className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
              <p className="text-lg">Leads directos a WhatsApp para cada agente</p>
            </div>
            <div className="flex items-start gap-3">
              <Check className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
              <p className="text-lg">Panel de administración con estadísticas</p>
            </div>
            <div className="flex items-start gap-3">
              <Check className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
              <p className="text-lg">Página corporativa con tu marca</p>
            </div>
            <div className="flex items-start gap-3 md:col-span-2 justify-center">
              <Check className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
              <p className="text-lg">Mayor visibilidad en las búsquedas de tu zona</p>
            </div>
          </div>
          <p className="text-center text-muted-foreground">
            Centraliza tu operación y mejora tus resultados con Kentra.
          </p>
        </div>
      </section>

      {/* Plans Section - TIER S - More visible above fold */}
      <section id="planes" className="container mx-auto px-4 py-12 scroll-mt-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-8" style={{ letterSpacing: '-0.02em' }}>Elige el plan perfecto para tu inmobiliaria</h2>
            
            <div className="max-w-md mx-auto mb-6">
              <CouponInput 
                onCouponApplied={setAppliedCoupon}
                onDiscountDetails={setCouponDiscount}
                planType="agency"
              />
            </div>
            
            {/* Billing Toggle - Enhanced */}
            <div className="inline-flex items-center gap-1 p-1.5 rounded-xl bg-muted/80 border border-border">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-6 py-2.5 rounded-lg transition-all duration-200 font-medium ${
                  billingPeriod === 'monthly' 
                    ? 'bg-background text-foreground shadow-md' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                }`}
              >
                Mensual
              </button>
              <button
                onClick={() => setBillingPeriod('annual')}
                className={`px-6 py-2.5 rounded-lg transition-all duration-200 font-medium flex items-center gap-2 ${
                  billingPeriod === 'annual' 
                    ? 'bg-background text-foreground shadow-md' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                }`}
              >
                Anual
                <Badge className="bg-green-100 text-green-700 border-0 text-xs font-semibold dark:bg-green-900 dark:text-green-100">
                  Ahorra 17%
                </Badge>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-10">
            {/* Plan Start - TIER S */}
            {(() => {
              const basePrice = billingPeriod === 'monthly' 
                ? (startPlan?.price_monthly || 1999) 
                : (startPlan?.price_yearly || 19990);
              const { original, final, savings } = getDiscountedPrice(basePrice);
              return (
                <Card className="transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-primary/30">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-2xl font-bold">Inmobiliaria Start</CardTitle>
                    <div className="mt-6">
                      {original && original !== final && (
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <span className="text-xl text-muted-foreground line-through">
                            ${original.toLocaleString('es-MX')}
                          </span>
                          <Badge variant="secondary" className="bg-green-100 text-green-800 text-sm font-semibold dark:bg-green-900 dark:text-green-100">
                            -${savings.toLocaleString('es-MX')}
                          </Badge>
                        </div>
                      )}
                      <div className="text-4xl md:text-5xl font-extrabold">
                        ${final.toLocaleString('es-MX')}
                      </div>
                      <div className="text-base text-muted-foreground mt-2">
                        MXN / {billingPeriod === 'monthly' ? 'mes' : 'año'}
                      </div>
                      {billingPeriod === 'annual' && startPlan?.price_yearly && (
                        <div className="text-sm text-muted-foreground mt-1">
                          Equivale a ${Math.round(startPlan.price_yearly / 12).toLocaleString('es-MX')}/mes
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-4">
                    <div className="space-y-4">
                      {getFeatureList(startPlan).map((feature, index) => (
                        <div key={index} className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                          <span className="text-foreground">{feature}</span>
                        </div>
                      ))}
                    </div>
                    <Button 
                      className="w-full h-12 text-base font-semibold" 
                      variant="outline"
                      onClick={() => handleSelectPlan('start')}
                      disabled={processingPlan !== null}
                    >
                      {processingPlan === 'start' ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Procesando...
                        </>
                      ) : (
                        'Comenzar con Start'
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Plan Grow - TIER S Highlighted */}
            {(() => {
              const basePrice = billingPeriod === 'monthly' 
                ? (growPlan?.price_monthly || 4499) 
                : (growPlan?.price_yearly || 44990);
              const { original, final, savings } = getDiscountedPrice(basePrice);
              return (
                <Card className={`relative transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${growPlan?.features?.display?.highlight ? 'border-primary border-2 shadow-lg ring-2 ring-primary/20' : ''}`}>
                  {growPlan?.features?.display?.badge && (
                    <Badge className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 text-sm font-semibold shadow-lg">
                      {growPlan.features.display.badge === 'popular' ? 'Más elegido' : growPlan.features.display.badge}
                    </Badge>
                  )}
                  <CardHeader className="pb-4">
                    <CardTitle className="text-2xl font-bold">Inmobiliaria Grow</CardTitle>
                    <div className="mt-6">
                      {original && original !== final && (
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <span className="text-xl text-muted-foreground line-through">
                            ${original.toLocaleString('es-MX')}
                          </span>
                          <Badge variant="secondary" className="bg-green-100 text-green-800 text-sm font-semibold dark:bg-green-900 dark:text-green-100">
                            -${savings.toLocaleString('es-MX')}
                          </Badge>
                        </div>
                      )}
                      <div className="text-4xl md:text-5xl font-extrabold">
                        ${final.toLocaleString('es-MX')}
                      </div>
                      <div className="text-base text-muted-foreground mt-2">
                        MXN / {billingPeriod === 'monthly' ? 'mes' : 'año'}
                      </div>
                      {billingPeriod === 'annual' && growPlan?.price_yearly && (
                        <div className="text-sm text-muted-foreground mt-1">
                          Equivale a ${Math.round(growPlan.price_yearly / 12).toLocaleString('es-MX')}/mes
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-4">
                    <div className="space-y-4">
                      {getFeatureList(growPlan).map((feature, index) => (
                        <div key={index} className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                          <span className="text-foreground">{feature}</span>
                        </div>
                      ))}
                    </div>
                    <Button 
                      className="w-full h-12 text-base font-semibold" 
                      onClick={() => handleSelectPlan('grow')}
                      disabled={processingPlan !== null}
                    >
                      {processingPlan === 'grow' ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Procesando...
                        </>
                      ) : (
                        'Continuar con Grow'
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Plan Pro */}
            {(() => {
              const basePrice = billingPeriod === 'monthly' 
                ? (proPlan?.price_monthly || 8999) 
                : (proPlan?.price_yearly || 89990);
              const { original, final, savings } = getDiscountedPrice(basePrice);
              return (
                <Card>
                  <CardHeader>
                    <CardTitle>Inmobiliaria Pro</CardTitle>
                    <div className="mt-4">
                      {original && original !== final && (
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <span className="text-lg text-muted-foreground line-through">
                            ${original.toLocaleString('es-MX')}
                          </span>
                          <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs dark:bg-green-900 dark:text-green-100">
                            Ahorras ${savings.toLocaleString('es-MX')}
                          </Badge>
                        </div>
                      )}
                      <div className="text-4xl font-bold">
                        ${final.toLocaleString('es-MX')}
                      </div>
                      <div className="text-muted-foreground">
                        MXN / {billingPeriod === 'monthly' ? 'mes' : 'año'}
                      </div>
                      {billingPeriod === 'annual' && proPlan?.price_yearly && (
                        <div className="text-sm text-muted-foreground mt-1">
                          Equivale a ${Math.round(proPlan.price_yearly / 12).toLocaleString('es-MX')}/mes
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      {getFeatureList(proPlan).map((feature, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={() => handleSelectPlan('pro')}
                      disabled={processingPlan !== null}
                    >
                      {processingPlan === 'pro' ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Procesando...
                        </>
                      ) : (
                        'Actualizar a Pro'
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })()}
          </div>
        </div>
      </section>

      {/* Upsells Section */}
      <section className="container mx-auto px-4 py-16 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Mejora la visibilidad de tu inmobiliaria.</h2>
            <p className="text-muted-foreground text-lg">
              Agrega capacidad y exposición adicional cuando lo necesites.
            </p>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Paquete de propiedades adicionales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>+50 propiedades</span>
                  <span className="font-bold">$799 / 30 días</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>+100 propiedades</span>
                  <span className="font-bold">$1,499 / 30 días</span>
                </div>
                <div className="text-sm text-muted-foreground mt-4 space-y-1">
                  <p>• Renovación automática junto con tu plan</p>
                  <p>• Límite máximo: +300 propiedades sobre tu capacidad</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Destacar propiedad</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>7 días</span>
                  <span className="font-bold">$59 MXN</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>30 días</span>
                  <span className="font-bold">$199 MXN</span>
                </div>
                <div className="text-sm text-muted-foreground mt-4">
                  <p>Las propiedades destacadas aparecen en primeras posiciones de su zona</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Portada Kentra / Newsletter destacada</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>Portada semanal</span>
                  <span className="font-bold">$1,499 MXN</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Portada mensual</span>
                  <span className="font-bold">$4,499 MXN</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Newsletter destacada</span>
                  <span className="font-bold">$499 MXN</span>
                </div>
                <div className="text-sm text-muted-foreground mt-4">
                  <p>Cupos limitados por ciudad y visibilidad nacional</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-8">
            Los upsells se renuevan según su duración. Puedes cancelarlos o renovarlos desde tu panel principal.
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Preguntas frecuentes</h2>
          
          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="item-1">
              <AccordionTrigger>¿Puedo agregar más agentes a mi cuenta?</AccordionTrigger>
              <AccordionContent>
                Sí. Cada plan tiene un número base de agentes incluidos. Puedes solicitar paquetes adicionales desde tu panel.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger>¿Qué pasa si supero mi límite de propiedades?</AccordionTrigger>
              <AccordionContent>
                Puedes adquirir paquetes adicionales de propiedades en cualquier momento. Se suman automáticamente a tu capacidad total.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger>¿Cómo funcionan los destacados?</AccordionTrigger>
              <AccordionContent>
                Los destacados aparecen en los primeros lugares de resultados por zona, ciudad y categoría durante el periodo contratado.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger>¿Puedo cancelar mi plan?</AccordionTrigger>
              <AccordionContent>
                Sí, en cualquier momento. Los cambios aplican al siguiente ciclo de facturación.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger>¿Emitimos factura?</AccordionTrigger>
              <AccordionContent>
                Sí, emitimos CFDI por cada ciclo con tus datos fiscales.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-bold mb-4">Lleva tu inmobiliaria al siguiente nivel.</h2>
          <p className="text-muted-foreground text-lg mb-8">
            Kentra te ayuda a profesionalizar tu equipo y aumentar tus ventas.
          </p>
          <Button size="lg" onClick={scrollToPlans}>
            Comenzar ahora
          </Button>
          <p className="text-sm text-muted-foreground mt-4">
            Sin contratos. Cancela cuando quieras.
          </p>
        </div>
      </section>
    </div>
  );
};

export default PricingInmobiliaria;
