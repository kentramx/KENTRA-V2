import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { DynamicBreadcrumbs } from '@/components/DynamicBreadcrumbs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Check, Info, Rocket, Zap, Crown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const PricingAgente = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pricingPeriod, setPricingPeriod] = useState<'monthly' | 'annual'>('annual');

  // Cargar preferencia de pricing desde localStorage al iniciar
  useEffect(() => {
    const savedPreference = localStorage.getItem('kentra_pricing_preference');
    if (savedPreference === 'monthly' || savedPreference === 'annual') {
      setPricingPeriod(savedPreference);
    }
  }, []);

  // Guardar preferencia cuando cambie
  useEffect(() => {
    localStorage.setItem('kentra_pricing_preference', pricingPeriod);
  }, [pricingPeriod]);

  // Scroll automático al plan cuando hay hash en la URL
  useEffect(() => {
    const hash = window.location.hash.slice(1); // Remove #
    if (hash) {
      setTimeout(() => {
        const element = document.getElementById(hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, []);

  const plans = [
    {
      id: '49d3847c-3dda-4f35-80a2-b4a66018100b',
      name: 'Agente Start',
      slug: 'basico',
      monthlyPrice: 249,
      annualPrice: 2480,
      annualMonthlyEquivalent: 206.67,
      features: [
        'Hasta 4 propiedades activas',
        'Perfil profesional básico',
        'Leads directo a WhatsApp',
        'Estadísticas esenciales',
      ],
      popular: false,
      buttonText: 'Empezar con Start',
      icon: Rocket,
    },
    {
      id: 'de96952c-ea83-4afb-a310-27f1f2db8f4e',
      name: 'Agente Pro',
      slug: 'pro',
      monthlyPrice: 599,
      annualPrice: 5966,
      annualMonthlyEquivalent: 497.17,
      features: [
        'Hasta 12 propiedades activas',
        '2 propiedades destacadas al mes',
        'Página profesional personalizada',
        'Contenido listo para compartir (copys + fotos optimizadas)',
        'Leads directo a WhatsApp',
      ],
      popular: true,
      buttonText: 'Activar plan Pro',
      icon: Zap,
    },
    {
      id: 'd4529d5f-725e-4513-9b29-1fecfc681708',
      name: 'Agente Elite',
      slug: 'elite',
      monthlyPrice: 999,
      annualPrice: 9950,
      annualMonthlyEquivalent: 829.17,
      features: [
        'Hasta 30 propiedades activas',
        '6 destacadas al mes + visibilidad prioritaria',
        'Branding premium en perfil',
        'IA para descripciones + programación de publicaciones',
        'Soporte prioritario',
      ],
      popular: false,
      buttonText: 'Subir a Elite',
      icon: Crown,
    },
  ];

  const handleSelectPlan = async (planId: string) => {
    if (!user) {
      navigate('/auth?redirect=/pricing-agente');
      return;
    }

    try {
      toast({
        title: 'Procesando...',
        description: 'Redirigiendo a la página de pago segura.',
      });

      const { supabase } = await import('@/integrations/supabase/client');
      
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          planId,
          billingCycle: pricingPeriod === 'annual' ? 'yearly' : 'monthly',
          successUrl: `${window.location.origin}/payment-success?payment=success`,
          cancelUrl: `${window.location.origin}/pricing-agente?payment=canceled`,
        },
      });

      if (error) {
        console.error('Error creating checkout session:', error);
        toast({
          title: 'Error',
          description: 'No se pudo crear la sesión de pago. Intenta de nuevo.',
          variant: 'destructive',
        });
        return;
      }

      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'Ocurrió un error inesperado. Intenta de nuevo.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <DynamicBreadcrumbs
          items={[
            { label: 'Inicio', href: '/', active: false },
            { label: 'Publicar', href: '/publicar', active: false },
            { label: 'Planes Agente', href: '', active: true },
          ]}
          className="mb-4"
        />

        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Planes para Agentes
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Publica tus propiedades y recibe leads directo a WhatsApp. Diseñado para agentes en todo México.
            </p>

            {/* Toggle */}
            <TooltipProvider>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setPricingPeriod('monthly')}
                  className={`text-base px-4 py-2 rounded-lg transition-colors ${
                    pricingPeriod === 'monthly'
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Mensual
                </button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setPricingPeriod('annual')}
                      className={`text-base px-4 py-2 rounded-lg transition-colors ${
                        pricingPeriod === 'annual'
                          ? 'bg-primary text-primary-foreground font-semibold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Anual -17%
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-semibold mb-2">Ahorro con pago anual:</p>
                    <ul className="space-y-1 text-sm">
                      <li>• Start: ${((249 * 12) - 2480).toLocaleString('es-MX')} MXN</li>
                      <li>• Pro: ${((599 * 12) - 5966).toLocaleString('es-MX')} MXN</li>
                      <li>• Elite: ${((999 * 12) - 9950).toLocaleString('es-MX')} MXN</li>
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
            <p className="text-sm text-muted-foreground mt-4">
              Puedes cancelar cuando quieras. El pago anual es opcional solo si deseas ahorrar.
            </p>
          </div>

          {/* Beneficios Principales */}
          <Card className="mb-8 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="pt-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold mb-6">¿Por qué elegirnos?</h2>
                <ul className="space-y-3 text-left max-w-2xl mx-auto">
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>Publica propiedades en minutos</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>Recibe leads directo a WhatsApp</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>Página profesional automática</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>Comparte tu catálogo con un solo enlace</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>IA para mejorar descripciones y visibilidad</span>
                  </li>
                </ul>
                <p className="text-sm text-muted-foreground mt-6 font-semibold">
                  Menos fricción. Más cierres.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Plans Grid */}
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                id={plan.slug}
                className={`relative scroll-mt-24 flex flex-col ${
                  plan.popular ? 'border-primary border-2 shadow-lg' : ''
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-4 py-1">
                      Más elegido
                    </Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <div className="mt-4">
                    {pricingPeriod === 'annual' ? (
                      <>
                        <div className="text-3xl font-bold">
                          ${plan.annualPrice.toLocaleString('es-MX')}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Pago adelantado (equivale a ${plan.annualMonthlyEquivalent.toLocaleString('es-MX')}/mes)
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="text-3xl font-bold">
                          ${plan.monthlyPrice.toLocaleString('es-MX')}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">por mes</p>
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col flex-1">
                  <ul className="space-y-3 mb-6 flex-1">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm">
                        <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={plan.popular ? 'default' : 'outline'}
                    onClick={() => handleSelectPlan(plan.id)}
                  >
                    {plan.icon && <plan.icon className="mr-2 h-5 w-5" />}
                    {plan.buttonText}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Upsells */}
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20 border-purple-200 dark:border-purple-800 mb-12">
            <CardContent className="pt-6">
              <div className="text-center">
                <h3 className="font-semibold text-2xl mb-4">
                  Crece solo cuando lo necesites.
                </h3>
                <div className="space-y-2 text-sm text-muted-foreground max-w-2xl mx-auto">
                  <p>• Slot adicional: $49–$99 / mes según volumen</p>
                  <p>• Destacar propiedad 7 días: $59</p>
                  <p>• Bot de WhatsApp: $149/mes</p>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Los slots adicionales se renuevan mensualmente con tu plan.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* FAQ Section */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-center mb-8">Preguntas Frecuentes</h2>
            <Accordion type="single" collapsible className="w-full space-y-4">
              <AccordionItem value="item-1" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left font-semibold">
                  ¿Mis propiedades caducan?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  No, mientras la suscripción esté activa.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left font-semibold">
                  ¿Puedo comprar más slots?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Sí, hasta 30 propiedades activas en plan Agente.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left font-semibold">
                  ¿Qué pasa si cambio de plan?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Los cambios aplican al siguiente ciclo.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left font-semibold">
                  ¿Puedo cancelar cuando quiera?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Sí, sin penalizaciones.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left font-semibold">
                  ¿Emiten factura?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Sí, CFDI en cada ciclo con tus datos fiscales.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Cierre Final */}
          <div className="text-center py-12">
            <h2 className="text-4xl font-bold mb-4">Empieza hoy.</h2>
            <p className="text-xl text-muted-foreground mb-8">
              Tu inventario merece verse profesional.
            </p>
            <Button size="lg" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              Comenzar ahora
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PricingAgente;
