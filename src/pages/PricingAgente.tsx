import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { startSubscriptionCheckout, getCurrentSubscription } from '@/utils/stripeCheckout';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { CouponInput } from '@/components/CouponInput';
import { SEOHead } from '@/components/SEOHead';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Check, Gift, Rocket, Zap, Crown, ArrowRight, Loader2 } from 'lucide-react';

const PricingAgente = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pricingPeriod, setPricingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

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
      // Verificar si ya tiene suscripción
      const { subscription } = await getCurrentSubscription();
      if (subscription) {
        toast.error('Ya tienes una suscripción activa. Ve a tu dashboard para gestionarla.');
        navigate('/panel-agente');
        return;
      }

      // Iniciar checkout con el nuevo sistema (incluye cupón si está aplicado)
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

  const plans = [
    {
      name: 'Agente Trial',
      slug: 'trial',
      isFree: true,
      monthlyPrice: 0,
      annualPrice: 0,
      features: [
        '1 propiedad activa',
        'Gratis por 14 días',
        'Visibilidad limitada',
        'Requiere verificación (email + teléfono)',
        'Sin destacados ni visibilidad prioritaria',
        'Recibe leads directo a WhatsApp',
        'Perfil profesional básico',
        'Al finalizar 14 días, la propiedad se oculta hasta contratar un plan',
      ],
      buttonText: 'Probar gratis',
      icon: Gift,
      popular: false,
    },
    {
      name: 'Agente Start',
      slug: 'start',
      monthlyPrice: 249,
      annualPrice: 2480,
      annualMonthlyEquivalent: 206.67,
      features: [
        'Hasta 4 propiedades activas',
        'Leads directos a WhatsApp',
        'Perfil profesional con catálogo compartible',
        'Estadísticas básicas',
        'Sello "Agente verificado" (tras KYC)',
        'Soporte por email',
      ],
      buttonText: 'Comenzar con Start',
      icon: Rocket,
      popular: false,
    },
    {
      name: 'Agente Pro',
      slug: 'pro',
      monthlyPrice: 599,
      annualPrice: 5966,
      annualMonthlyEquivalent: 497.17,
      features: [
        'Hasta 12 propiedades activas',
        '2 propiedades destacadas al mes',
        'Visibilidad prioritaria en listados',
        'Perfil personalizado con branding',
        'Copys automáticos con IA',
        'Reporte semanal de leads',
        'Chat de soporte prioritario',
      ],
      buttonText: 'Continuar con Pro',
      icon: Zap,
      popular: true,
    },
    {
      name: 'Agente Elite',
      slug: 'elite',
      monthlyPrice: 999,
      annualPrice: 9950,
      annualMonthlyEquivalent: 829.17,
      features: [
        'Hasta 30 propiedades activas',
        '6 destacadas al mes',
        'Máxima visibilidad y posición preferente',
        'Branding premium y diseño personalizado',
        'Copys IA + analítica avanzada',
        'Programación de publicaciones',
        'Asesor dedicado',
      ],
      buttonText: 'Actualizar a Elite',
      icon: Crown,
      popular: false,
    },
  ];

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
      
      <div className="container mx-auto px-4 py-16 md:py-24">
        {/* Hero Section */}
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Planes para Agentes</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Publica tus propiedades, recibe leads directos y haz crecer tu negocio inmobiliario con Kentra.
          </p>
          <Button size="lg" onClick={scrollToPlans} className="group">
            Comenzar ahora
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

        {/* Plans Section */}
        <div id="planes" className="max-w-7xl mx-auto mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Elige tu plan</h2>
            
            <div className="max-w-md mx-auto mb-6">
              <CouponInput 
                onCouponApplied={setAppliedCoupon}
                planType="agent"
              />
            </div>
            
            {/* Toggle Mensual/Anual */}
            <div className="inline-flex items-center gap-4 p-1 rounded-lg bg-muted">
              <button
                onClick={() => setPricingPeriod('monthly')}
                className={`px-6 py-2 rounded-md transition-all ${
                  pricingPeriod === 'monthly'
                    ? 'bg-background text-foreground font-semibold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Mensual
              </button>
              <button
                onClick={() => setPricingPeriod('annual')}
                className={`px-6 py-2 rounded-md transition-all flex items-center gap-2 ${
                  pricingPeriod === 'annual'
                    ? 'bg-background text-foreground font-semibold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Anual
                <Badge variant="secondary" className="text-xs">-17%</Badge>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan) => {
              const Icon = plan.icon;
              const displayPrice = plan.isFree 
                ? 'Gratis' 
                : pricingPeriod === 'annual'
                  ? `$${plan.annualPrice?.toLocaleString('es-MX')}`
                  : `$${plan.monthlyPrice?.toLocaleString('es-MX')}`;
              
              return (
                <Card 
                  key={plan.slug}
                  className={`relative ${plan.popular ? 'border-primary border-2 shadow-lg' : ''}`}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                      Más elegido
                    </Badge>
                  )}
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <div className="mt-4">
                      {plan.isFree ? (
                        <div className="text-3xl font-bold">Gratis</div>
                      ) : (
                        <>
                          <div className="text-3xl font-bold">{displayPrice}</div>
                          {pricingPeriod === 'annual' && plan.annualMonthlyEquivalent && (
                            <p className="text-sm text-muted-foreground mt-1">
                              equivale a ${plan.annualMonthlyEquivalent.toFixed(2)}/mes
                            </p>
                          )}
                          {pricingPeriod === 'monthly' && (
                            <p className="text-sm text-muted-foreground mt-1">por mes</p>
                          )}
                          {pricingPeriod === 'annual' && (
                            <p className="text-sm text-muted-foreground mt-1">pago anual</p>
                          )}
                        </>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3 mb-6">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button 
                      className="w-full"
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
