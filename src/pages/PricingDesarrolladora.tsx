import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { startSubscriptionCheckout, getCurrentSubscription } from '@/utils/stripeCheckout';
import { usePricingPlans, getPlanMaxProjects, getMonthlyEquivalent } from '@/hooks/usePricingPlans';
import Navbar from '@/components/Navbar';
import { CouponInput } from '@/components/CouponInput';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Building2, MapPin, BarChart3, Users, FileText, Award, Loader2 } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Label } from '@/components/ui/label';

const PricingDesarrolladora = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState<{type: 'percent' | 'fixed', value: number} | null>(null);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  const { data: dbPlans, isLoading: plansLoading } = usePricingPlans('developer');

  // Find plans by name
  const startPlan = dbPlans?.find(p => p.name === 'desarrolladora_start');
  const growPlan = dbPlans?.find(p => p.name === 'desarrolladora_grow');
  const proPlan = dbPlans?.find(p => p.name === 'desarrolladora_pro');

  // Helper to get features from DB or fallback
  const getFeatureList = (plan: any): string[] => {
    if (plan?.features?.feature_list && Array.isArray(plan.features.feature_list)) {
      return plan.features.feature_list.map((f: any) => f.text);
    }
    // Fallback
    const features: string[] = [];
    const limits = plan?.features?.limits || plan?.features || {};
    const caps = plan?.features?.capabilities || plan?.features || {};
    if (limits.max_projects) {
      features.push(limits.max_projects === 1 ? '1 proyecto activo' : `Hasta ${limits.max_projects} proyectos activos`);
    }
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
    document.getElementById('planes')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSelectPlan = async (planSlug: string) => {
    if (processingPlan) return;
    
    if (!user) {
      navigate('/auth?redirect=/pricing-desarrolladora');
      return;
    }

    setProcessingPlan(planSlug);
    try {
      // Verificar si ya tiene suscripción CON Stripe
      // Usuarios Trial (sin stripe_subscription_id) pueden continuar a checkout
      const { subscription } = await getCurrentSubscription();
      if (subscription && subscription.stripe_subscription_id) {
        toast.error('Ya tienes una suscripción activa. Ve a tu dashboard para gestionarla.');
        navigate('/panel-desarrolladora');
        return;
      }

      // Buscar el plan completo para verificar si es trial (precio = 0)
      const fullPlanName = `desarrolladora_${planSlug}`;
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
        navigate('/panel-desarrolladora');
        return;
      }

      // Iniciar checkout con el nuevo sistema (incluye cupón si está aplicado)
      const billingCycleValue = billingCycle === 'monthly' ? 'monthly' : 'yearly';
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
                  {[1, 2, 3, 4, 5, 6, 7].map(j => (
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
      
      {/* Hero Section - TIER S */}
      <section className="container mx-auto px-4 py-20 md:py-28 text-center">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6" style={{ letterSpacing: '-0.025em' }}>Planes para Desarrolladoras</h1>
        <p className="text-muted-foreground text-xl md:text-2xl max-w-3xl mx-auto mb-10">
          Promociona tus proyectos, genera leads calificados y posiciona tu marca con Kentra.
        </p>
        <Button size="lg" onClick={scrollToPlans} className="h-14 px-8 text-lg">
          Comenzar ahora
        </Button>
      </section>

      {/* Intro Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">
            Visibilidad profesional para tus proyectos inmobiliarios.
          </h2>
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="flex gap-3">
              <Building2 className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
              <p className="text-muted-foreground">Publica tus desarrollos con micrositios personalizados</p>
            </div>
            <div className="flex gap-3">
              <Users className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
              <p className="text-muted-foreground">Genera leads directos a tu equipo de ventas</p>
            </div>
            <div className="flex gap-3">
              <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
              <p className="text-muted-foreground">Muestra renders, videos, planos y ubicación en mapa</p>
            </div>
            <div className="flex gap-3">
              <Award className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
              <p className="text-muted-foreground">Posiciona tu marca en el mercado inmobiliario</p>
            </div>
            <div className="flex gap-3">
              <BarChart3 className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
              <p className="text-muted-foreground">Recibe reportes mensuales del desempeño de tus proyectos</p>
            </div>
          </div>
          <p className="text-sm text-center text-muted-foreground">
            Kentra conecta tus desarrollos con miles de compradores e inversionistas en todo México.
          </p>
        </div>
      </section>

      {/* Plans Section - TIER S */}
      <section id="planes" className="container mx-auto px-4 py-20 scroll-mt-20">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-md mx-auto mb-10">
            <CouponInput 
              onCouponApplied={setAppliedCoupon}
              onDiscountDetails={setCouponDiscount}
              planType="developer"
            />
          </div>
          
          {/* Billing Toggle - Enhanced TIER S */}
          <div className="flex justify-center items-center gap-4 mb-14">
            <div className="inline-flex items-center gap-1 p-2 rounded-2xl bg-muted/80 border border-border">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-8 py-3 rounded-xl transition-all duration-200 font-semibold text-base ${
                  billingCycle === 'monthly' 
                    ? 'bg-background text-foreground shadow-md' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                }`}
              >
                Mensual
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                className={`px-8 py-3 rounded-xl transition-all duration-200 font-semibold text-base flex items-center gap-2 ${
                  billingCycle === 'annual' 
                    ? 'bg-background text-foreground shadow-md' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                }`}
              >
                Anual
                <Badge className="bg-green-100 text-green-700 border-0 text-sm font-semibold dark:bg-green-900 dark:text-green-100">
                  Ahorra 17%
                </Badge>
              </button>
            </div>
          </div>

          {/* Plan Cards - TIER S */}
          <div className="grid md:grid-cols-3 gap-8 lg:gap-10">
            {/* Start Plan */}
            {(() => {
              const basePrice = billingCycle === 'monthly' 
                ? (startPlan?.price_monthly || 5990) 
                : (startPlan?.price_yearly || 59900);
              const { original, final, savings } = getDiscountedPrice(basePrice);
              return (
                <Card className="transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-primary/30">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-2xl font-bold">Desarrolladora Start</CardTitle>
                    <CardDescription>
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
                      <span className="text-4xl md:text-5xl font-extrabold text-foreground">
                        ${final.toLocaleString('es-MX')}
                      </span>
                      <span className="text-muted-foreground text-base"> MXN</span>
                      {billingCycle === 'annual' && startPlan?.price_yearly && (
                        <span className="block text-sm mt-1">
                          equivale a ${Math.round(startPlan.price_yearly / 12).toLocaleString('es-MX')}/mes
                        </span>
                      )}
                      <span className="block text-sm mt-1">
                        {billingCycle === 'monthly' ? 'por mes' : 'por año'}
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <ul className="space-y-4 mb-8">
                      {getFeatureList(startPlan).map((feature, index) => (
                        <li key={index} className="flex gap-3">
                          <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                          <span className="text-sm text-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
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
                  </CardFooter>
                </Card>
              );
            })()}

            {/* Grow Plan - Más elegido */}
            {(() => {
              const basePrice = billingCycle === 'monthly' 
                ? (growPlan?.price_monthly || 12900) 
                : (growPlan?.price_yearly || 129000);
              const { original, final, savings } = getDiscountedPrice(basePrice);
              return (
                <Card className={`relative ${growPlan?.features?.display?.highlight ? 'border-primary shadow-lg' : ''}`}>
                  {growPlan?.features?.display?.badge && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                      {growPlan.features.display.badge === 'popular' ? 'Más elegido' : growPlan.features.display.badge}
                    </Badge>
                  )}
                  <CardHeader>
                    <CardTitle>Desarrolladora Grow</CardTitle>
                    <CardDescription>
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
                      <span className="text-3xl font-bold text-foreground">
                        ${final.toLocaleString('es-MX')}
                      </span>
                      <span className="text-muted-foreground"> MXN</span>
                      {billingCycle === 'annual' && growPlan?.price_yearly && (
                        <span className="block text-sm mt-1">
                          equivale a ${Math.round(growPlan.price_yearly / 12).toLocaleString('es-MX')}/mes
                        </span>
                      )}
                      <span className="block text-sm mt-1">
                        {billingCycle === 'monthly' ? 'por mes' : 'por año'}
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {getFeatureList(growPlan).map((feature, index) => (
                        <li key={index} className="flex gap-2">
                          <Check className="w-5 h-5 text-primary flex-shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      className="w-full"
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
                  </CardFooter>
                </Card>
              );
            })()}

            {/* Pro Plan */}
            {(() => {
              const basePrice = billingCycle === 'monthly' 
                ? (proPlan?.price_monthly || 24900) 
                : (proPlan?.price_yearly || 249000);
              const { original, final, savings } = getDiscountedPrice(basePrice);
              return (
                <Card>
                  <CardHeader>
                    <CardTitle>Desarrolladora Pro</CardTitle>
                    <CardDescription>
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
                      <span className="text-3xl font-bold text-foreground">
                        ${final.toLocaleString('es-MX')}
                      </span>
                      <span className="text-muted-foreground"> MXN</span>
                      {billingCycle === 'annual' && proPlan?.price_yearly && (
                        <span className="block text-sm mt-1">
                          equivale a ${Math.round(proPlan.price_yearly / 12).toLocaleString('es-MX')}/mes
                        </span>
                      )}
                      <span className="block text-sm mt-1">
                        {billingCycle === 'monthly' ? 'por mes' : 'por año'}
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {getFeatureList(proPlan).map((feature, index) => (
                        <li key={index} className="flex gap-2">
                          <Check className="w-5 h-5 text-primary flex-shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      className="w-full" 
                      variant="outline"
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
                  </CardFooter>
                </Card>
              );
            })()}
          </div>
        </div>
      </section>

      {/* Upsells Section */}
      <section className="container mx-auto px-4 py-16 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">
            Aumenta la visibilidad de tus proyectos.
          </h2>
          <p className="text-center text-muted-foreground mb-12">
            Opciones adicionales para maximizar el alcance de tu marca.
          </p>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Proyecto adicional</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex justify-between items-center">
                    <span>$1,499 MXN / 30 días</span>
                  </li>
                  <li className="text-sm text-muted-foreground">
                    Publica un desarrollo más sin cambiar de plan
                  </li>
                  <li className="text-sm text-muted-foreground">
                    Renovación automática junto con la suscripción
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Destacar proyecto</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex justify-between items-center">
                    <span>7 días</span>
                    <span className="font-semibold">$199 MXN</span>
                  </li>
                  <li className="flex justify-between items-center">
                    <span>30 días</span>
                    <span className="font-semibold">$499 MXN</span>
                  </li>
                  <li className="text-sm text-muted-foreground mt-3">
                    Tu proyecto aparece en las primeras posiciones de su zona y en la home
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Portada Kentra / Newsletter desarrolladores</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex justify-between items-center">
                    <span>Portada semanal</span>
                    <span className="font-semibold">$2,499 MXN</span>
                  </li>
                  <li className="flex justify-between items-center">
                    <span>Newsletter destacada</span>
                    <span className="font-semibold">$999 MXN</span>
                  </li>
                  <li className="text-sm text-muted-foreground mt-3">
                    Cupos limitados por región y visibilidad nacional
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <p className="text-sm text-center text-muted-foreground mt-8">
            Los upsells se renuevan automáticamente según su duración y pueden cancelarse o renovarse desde tu panel.
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Preguntas frecuentes</h2>
          
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>¿Qué se considera un proyecto?</AccordionTrigger>
              <AccordionContent>
                Cada desarrollo o fraccionamiento con identidad propia, renders, planos y contacto de ventas.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger>¿Puedo agregar más proyectos?</AccordionTrigger>
              <AccordionContent>
                Sí. Puedes comprar proyectos adicionales por 30 días desde tu panel sin cambiar de plan.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger>¿Hay límite de unidades por proyecto?</AccordionTrigger>
              <AccordionContent>
                No. Puedes cargar todas las unidades o modelos dentro del proyecto sin costo adicional.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger>¿Qué diferencia hay entre Grow y Pro?</AccordionTrigger>
              <AccordionContent>
                Grow ofrece visibilidad regional con publicaciones destacadas. Pro brinda presencia nacional, inclusión en portada y reportes personalizados.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger>¿Puedo cancelar mi plan en cualquier momento?</AccordionTrigger>
              <AccordionContent>
                Sí, puedes cancelar cuando desees. Los cambios aplican al siguiente ciclo de facturación.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6">
              <AccordionTrigger>¿Emitimos factura?</AccordionTrigger>
              <AccordionContent>
                Sí, emitimos CFDI en cada ciclo de facturación con tus datos fiscales.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Haz que tus desarrollos lleguen más lejos.
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            Kentra impulsa tus proyectos con visibilidad profesional, leads reales y posicionamiento nacional.
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

export default PricingDesarrolladora;
