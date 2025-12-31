import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { startSubscriptionCheckout, getCurrentSubscription } from '@/utils/stripeCheckout';
import { usePricingPlans, getPlanPropertyLimit, getPlanFeaturedLimit, getMonthlyEquivalent } from '@/hooks/usePricingPlans';
import Navbar from '@/components/Navbar';
import { CouponInput } from '@/components/CouponInput';
import { SEOHead } from '@/components/SEOHead';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Gift, Rocket, Zap, Crown, ArrowRight, Loader2 } from 'lucide-react';

const getIconForSlug = (slug: string) => {
  switch (slug) {
    case 'trial': return Gift;
    case 'start': return Rocket;
    case 'pro': return Zap;
    case 'elite': return Crown;
    default: return Rocket;
  }
};

const buildFeaturesArray = (plan: any): string[] => {
  // Priorizar feature_list de la nueva estructura de BD
  if (plan.features?.feature_list && Array.isArray(plan.features.feature_list)) {
    return plan.features.feature_list.map((f: any) => f.text);
  }
  
  // Fallback: generar features dinámicamente desde limits/capabilities
  const features: string[] = [];
  const propLimit = getPlanPropertyLimit(plan);
  const featuredLimit = getPlanFeaturedLimit(plan);
  
  if (propLimit === -1) {
    features.push('Propiedades ilimitadas');
  } else if (propLimit > 0) {
    features.push(`Hasta ${propLimit} propiedad${propLimit > 1 ? 'es' : ''} activa${propLimit > 1 ? 's' : ''}`);
  }
  
  if (featuredLimit === -1) {
    features.push('Destacadas ilimitadas');
  } else if (featuredLimit > 0) {
    features.push(`${featuredLimit} propiedad${featuredLimit > 1 ? 'es' : ''} destacada${featuredLimit > 1 ? 's' : ''} al mes`);
  }
  
  const caps = plan.features?.capabilities || plan.features || {};
  if (caps.priority_support) features.push('Soporte prioritario');
  else features.push('Soporte por email');
  if (caps.analytics) features.push('Analíticas avanzadas');
  if (caps.autopublicacion) features.push('Autopublicación a redes');
  if (caps.reportes_avanzados) features.push('Reportes avanzados');
  if (caps.ia_copys) features.push('Copys automáticos con IA');
  if (caps.asesor_dedicado) features.push('Asesor dedicado');
  
  return features;
};

const PricingAgente = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pricingPeriod, setPricingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState<{type: 'percent' | 'fixed', value: number} | null>(null);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  const { data: dbPlans, isLoading: plansLoading } = usePricingPlans('agent');

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
    const element = document.getElementById('planes');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSelectPlan = async (planSlug: string) => {
    if (!user) {
      navigate('/auth?redirect=/pricing-agente');
      return;
    }

    setProcessingPlan(planSlug);
    try {
      // Verificar si ya tiene suscripción CON Stripe
      const { subscription } = await getCurrentSubscription();
      // Solo bloquear si tiene suscripción con stripe_subscription_id
      // Usuarios Trial (sin Stripe) pueden continuar a checkout
      if (subscription && subscription.stripe_subscription_id) {
        toast.error('Ya tienes una suscripción activa. Ve a tu dashboard para gestionarla.');
        navigate('/panel-agente');
        return;
      }

      // Encontrar el plan para saber si es gratuito
      const selectedPlan = dbPlans?.find(p => p.name.replace('agente_', '') === planSlug);
      
      // Si es plan gratuito (precio $0), usar start-trial directamente
      if (selectedPlan && selectedPlan.price_monthly === 0) {
        const { startFreeTrial } = await import('@/utils/stripeCheckout');
        const result = await startFreeTrial();
        if (result.success) {
          toast.success('¡Tu prueba gratuita ha comenzado!');
          navigate('/panel-agente');
          return;
        } else {
          toast.error(result.error || 'No pudimos iniciar tu prueba gratuita');
          return;
        }
      }

      // Si es plan de pago, ir a Stripe checkout
      const billingCycle = pricingPeriod === 'monthly' ? 'monthly' : 'yearly';
      const result = await startSubscriptionCheckout(`agente_${planSlug}`, billingCycle, appliedCoupon || undefined);

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

  // Map database plans to component format
  const plans = dbPlans?.map(plan => {
    const slug = plan.name.replace('agente_', '');
    const isFree = plan.price_monthly === 0;
    
    return {
      name: plan.display_name,
      slug,
      icon: getIconForSlug(slug),
      monthlyPrice: plan.price_monthly,
      annualPrice: plan.price_yearly || plan.price_monthly * 10,
      annualMonthlyEquivalent: plan.price_yearly ? getMonthlyEquivalent(plan.price_yearly) : plan.price_monthly,
      isFree,
      popular: slug === 'pro',
      buttonText: isFree ? 'Probar gratis' : slug === 'start' ? 'Comenzar con Start' : slug === 'pro' ? 'Continuar con Pro' : 'Actualizar a Elite',
      features: buildFeaturesArray(plan),
    };
  }) || [];

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
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {[1, 2, 3, 4].map(i => (
              <Card key={i}>
                <CardHeader className="text-center">
                  <Skeleton className="h-12 w-12 rounded-full mx-auto mb-4" />
                  <Skeleton className="h-6 w-24 mx-auto mb-2" />
                  <Skeleton className="h-10 w-32 mx-auto" />
                </CardHeader>
                <CardContent>
                  {[1, 2, 3, 4, 5, 6].map(j => (
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

  const upsells = [
    {
      name: 'Slot adicional de propiedad',
      price: '$79 MXN / 30 días',
      description: 'Renovación automática junto con tu plan. Límite: 10 adicionales sobre el tope del plan',
    },
    {
      name: 'Destacar propiedad',
      price: '7 días – $59 MXN | 30 días – $199 MXN',
      description: 'Destacadas aparecen arriba en su zona y en correo semanal',
    },
    {
      name: 'Portada Kentra',
      price: 'Semanal $499 | Mensual $1,499 | Newsletter $299',
      description: 'Cupos limitados por ciudad',
    },
  ];

  const faqs = [
    {
      question: '¿Mis propiedades caducan?',
      answer: 'No. Mientras tu suscripción esté activa, tus propiedades permanecen publicadas.',
    },
    {
      question: '¿Puedo comprar más slots?',
      answer: 'Sí. Desde tu panel puedes agregar hasta 10 adicionales con costo mensual.',
    },
    {
      question: '¿Qué pasa si cambio de plan o elimino upsells?',
      answer: 'Los cambios aplican al siguiente ciclo. Conservas visibilidad hasta la fecha de renovación.',
    },
    {
      question: '¿Puedo cancelar cuando quiera?',
      answer: 'Sí, sin penalizaciones. La cancelación aplica al siguiente ciclo.',
    },
    {
      question: '¿Recibo factura?',
      answer: 'Sí, emitimos CFDI por cada ciclo con tus datos fiscales.',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Planes para Agentes Inmobiliarios en México | Kentra"
        description="Planes desde $299/mes para agentes inmobiliarios. Publica hasta 5 propiedades, recibe leads directos y haz crecer tu negocio. Prueba gratis 14 días."
        canonical="/pricing-agente"
      />
      <Navbar />
      
      <div className="container mx-auto px-4 py-12 md:py-16">
        {/* Hero Section - TIER S - Compact to show plans above fold */}
        <div className="max-w-4xl mx-auto text-center mb-12 md:mb-16">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold mb-4" style={{ letterSpacing: '-0.025em' }}>Planes para Agentes</h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-6 max-w-2xl mx-auto">
            Publica tus propiedades, recibe leads directos y haz crecer tu negocio.
          </p>
          <Button size="lg" onClick={scrollToPlans} className="group h-12 px-6">
            Ver planes
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>

        {/* Descriptive Section */}
        <div className="max-w-4xl mx-auto mb-20">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-2xl text-center">
                Hecho para agentes que quieren vender más, sin complicarse.
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Publica propiedades en minutos</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Recibe leads directo a WhatsApp</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Crea tu perfil profesional en automático</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Accede a estadísticas y métricas de tus listados</span>
                </div>
                <div className="flex items-start gap-3 md:col-span-2">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Comparte tu catálogo con un solo enlace</span>
                </div>
              </div>
              <p className="text-center text-sm text-muted-foreground font-medium">
                Más visibilidad. Más contactos. Más cierres.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Plans Section - TIER S - VISIBLE ABOVE FOLD */}
        <div id="planes" className="max-w-7xl mx-auto mb-16 scroll-mt-20">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-6" style={{ letterSpacing: '-0.02em' }}>Elige tu plan</h2>
            
            <div className="max-w-md mx-auto mb-6">
              <CouponInput 
                onCouponApplied={setAppliedCoupon}
                onDiscountDetails={setCouponDiscount}
                planType="agent"
              />
            </div>
            
            {/* Toggle Mensual/Anual - Enhanced */}
            <div className="inline-flex items-center gap-1 p-1.5 rounded-xl bg-muted/80 border border-border">
              <button
                onClick={() => setPricingPeriod('monthly')}
                className={`px-6 py-2.5 rounded-lg transition-all duration-200 font-medium ${
                  pricingPeriod === 'monthly'
                    ? 'bg-background text-foreground shadow-md'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                }`}
              >
                Mensual
              </button>
              <button
                onClick={() => setPricingPeriod('annual')}
                className={`px-6 py-2.5 rounded-lg transition-all duration-200 font-medium flex items-center gap-2 ${
                  pricingPeriod === 'annual'
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

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan) => {
              const Icon = plan.icon;
              const basePrice = plan.isFree 
                ? 0 
                : pricingPeriod === 'annual'
                  ? plan.annualPrice!
                  : plan.monthlyPrice!;
              const { original, final, savings } = getDiscountedPrice(basePrice);
              
              return (
                <Card 
                  key={plan.slug}
                  className={`relative transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${plan.popular ? 'border-primary border-2 shadow-lg ring-2 ring-primary/20' : 'hover:border-primary/30'}`}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 text-sm font-semibold shadow-lg">
                      Más elegido
                    </Badge>
                  )}
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-3 rounded-xl bg-primary/10">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                    <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                    <div className="mt-6">
                      {plan.isFree ? (
                        <div className="text-4xl md:text-5xl font-extrabold">Gratis</div>
                      ) : (
                        <>
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
                          <div className="text-4xl md:text-5xl font-extrabold">${final.toLocaleString('es-MX')}</div>
                          {pricingPeriod === 'annual' && plan.annualMonthlyEquivalent && (
                            <p className="text-base text-muted-foreground mt-2">
                              equivale a ${plan.annualMonthlyEquivalent.toFixed(0)}/mes
                            </p>
                          )}
                          {pricingPeriod === 'monthly' && (
                            <p className="text-base text-muted-foreground mt-2">por mes</p>
                          )}
                          {pricingPeriod === 'annual' && (
                            <p className="text-base text-muted-foreground mt-2">pago anual</p>
                          )}
                        </>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <ul className="space-y-4 mb-8">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-sm">
                          <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button 
                      className="w-full h-12 text-base font-semibold"
                      variant={plan.popular ? 'default' : 'outline'}
                      onClick={() => handleSelectPlan(plan.slug)}
                      disabled={processingPlan !== null}
                    >
                      {processingPlan === plan.slug ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Procesando...
                        </>
                      ) : (
                        plan.buttonText
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Upsells Section */}
        <div className="max-w-5xl mx-auto mb-20">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-2">Agrega más visibilidad cuando la necesites.</h2>
          </div>
          
          <div className="space-y-4 mb-4">
            {upsells.map((upsell, idx) => (
              <Card key={idx}>
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{upsell.name}</h3>
                      <p className="text-sm text-muted-foreground">{upsell.description}</p>
                    </div>
                    <div className="md:text-right">
                      <p className="font-bold text-primary">{upsell.price}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <p className="text-sm text-muted-foreground text-center">
            Los upsells se renuevan automáticamente según su duración. Puedes cancelarlos en cualquier momento desde tu panel.
          </p>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto mb-20">
          <h2 className="text-3xl font-bold text-center mb-8">Preguntas frecuentes</h2>
          <Accordion type="single" collapsible className="w-full space-y-4">
            {faqs.map((faq, idx) => (
              <AccordionItem key={idx} value={`item-${idx}`} className="border rounded-lg px-6">
                <AccordionTrigger className="text-left font-semibold hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Final CTA */}
        <div className="max-w-3xl mx-auto text-center">
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader>
              <CardTitle className="text-3xl md:text-4xl mb-4">Empieza hoy.</CardTitle>
              <CardDescription className="text-lg">
                Tu inventario merece la visibilidad que ofrece Kentra.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="lg" className="mb-3" onClick={scrollToPlans}>
                Comenzar ahora
              </Button>
              <p className="text-sm text-muted-foreground">
                Sin contratos. Cancela cuando quieras.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PricingAgente;
