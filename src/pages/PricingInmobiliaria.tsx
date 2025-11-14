import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { createStripeCheckoutSession, checkActiveSubscription, getPlanBySlug } from '@/utils/stripeCheckout';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const PricingInmobiliaria = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

  const scrollToPlans = () => {
    const plansSection = document.getElementById('planes');
    plansSection?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSelectPlan = async (planSlug: string) => {
    if (!user) {
      navigate('/auth?redirect=/pricing-inmobiliaria');
      return;
    }

    try {
      // Verificar suscripción activa
      const { hasActive } = await checkActiveSubscription(user.id);
      if (hasActive) {
        toast.error('Ya tienes una suscripción activa. Ve a tu dashboard para gestionar tu plan.');
        navigate('/panel-inmobiliaria');
        return;
      }

      // Obtener plan
      const { plan, error: planError } = await getPlanBySlug('inmobiliaria', planSlug);
      if (planError || !plan) {
        toast.error(planError || 'No se pudo encontrar el plan seleccionado');
        return;
      }

      // Mostrar confirmación
      const price = billingPeriod === 'monthly' ? plan.price_monthly : plan.price_yearly;
      const period = billingPeriod === 'monthly' ? 'mes' : 'año';
      toast.success(`Redirigiendo al checkout de ${plan.display_name} - $${price} MXN/${period}`);

      // Crear sesión de checkout
      const result = await createStripeCheckoutSession({
        planId: plan.id,
        billingCycle: billingPeriod === 'monthly' ? 'monthly' : 'yearly',
        successUrl: `${window.location.origin}/payment-success?payment=success&plan=${plan.name}`,
        cancelUrl: `${window.location.origin}/pricing-inmobiliaria`,
      });

      if (!result.success) {
        toast.error(result.error || 'Error al crear la sesión de pago');
        return;
      }

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Ocurrió un error al procesar tu solicitud');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-5xl font-bold mb-6">Planes para Inmobiliarias</h1>
        <p className="text-muted-foreground text-xl max-w-3xl mx-auto mb-8">
          Gestiona tu equipo, administra tus propiedades y obtén mayor visibilidad con Kentra Inmobiliarias.
        </p>
        <Button size="lg" onClick={scrollToPlans}>
          Comenzar ahora
        </Button>
      </section>

      {/* Intro Section */}
      <section className="container mx-auto px-4 py-16">
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

      {/* Plans Section */}
      <section id="planes" className="container mx-auto px-4 py-16">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-6">Elige el plan perfecto para tu inmobiliaria</h2>
            
            {/* Billing Toggle */}
            <div className="inline-flex items-center gap-2 p-1 bg-muted rounded-lg">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-6 py-2 rounded-md transition-colors ${
                  billingPeriod === 'monthly' 
                    ? 'bg-background shadow-sm' 
                    : 'hover:bg-background/50'
                }`}
              >
                Mensual
              </button>
              <button
                onClick={() => setBillingPeriod('annual')}
                className={`px-6 py-2 rounded-md transition-colors flex items-center gap-2 ${
                  billingPeriod === 'annual' 
                    ? 'bg-background shadow-sm' 
                    : 'hover:bg-background/50'
                }`}
              >
                Anual
                <Badge variant="secondary" className="text-xs">-17%</Badge>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Plan Start */}
            <Card>
              <CardHeader>
                <CardTitle>Inmobiliaria Start</CardTitle>
                <div className="mt-4">
                  <div className="text-4xl font-bold">
                    ${billingPeriod === 'monthly' ? '1,999' : '19,990'}
                  </div>
                  <div className="text-muted-foreground">
                    MXN / {billingPeriod === 'monthly' ? 'mes' : 'año'}
                  </div>
                  {billingPeriod === 'annual' && (
                    <div className="text-sm text-muted-foreground mt-1">
                      Equivale a $1,665/mes
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Hasta 100 propiedades activas</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Hasta 5 agentes incluidos</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Dashboard multiagente</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Perfiles individuales por agente</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Asignación de propiedades al equipo</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Estadísticas por propiedad y por agente</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Página corporativa personalizada</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Visibilidad estándar en resultados</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>5 propiedades destacadas al mes</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Soporte por email</span>
                  </div>
                </div>
                <Button className="w-full" onClick={() => handleSelectPlan('start')}>
                  Comenzar con Start
                </Button>
              </CardContent>
            </Card>

            {/* Plan Grow */}
            <Card className="border-primary relative">
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                Más elegido
              </Badge>
              <CardHeader>
                <CardTitle>Inmobiliaria Grow</CardTitle>
                <div className="mt-4">
                  <div className="text-4xl font-bold">
                    ${billingPeriod === 'monthly' ? '4,499' : '44,990'}
                  </div>
                  <div className="text-muted-foreground">
                    MXN / {billingPeriod === 'monthly' ? 'mes' : 'año'}
                  </div>
                  {billingPeriod === 'annual' && (
                    <div className="text-sm text-muted-foreground mt-1">
                      Equivale a $3,749/mes
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Hasta 250 propiedades activas</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Hasta 10 agentes incluidos</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Dashboard multiagente y administración avanzada</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Perfiles y catálogo individual por agente</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Asignación de propiedades y control de inventario</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Estadísticas por agente y rendimiento del equipo</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Página corporativa personalizada</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Visibilidad alta en listados y búsquedas</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>15 propiedades destacadas al mes</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Soporte por email</span>
                  </div>
                </div>
                <Button className="w-full" onClick={() => handleSelectPlan('grow')}>
                  Continuar con Grow
                </Button>
              </CardContent>
            </Card>

            {/* Plan Pro */}
            <Card>
              <CardHeader>
                <CardTitle>Inmobiliaria Pro</CardTitle>
                <div className="mt-4">
                  <div className="text-4xl font-bold">
                    ${billingPeriod === 'monthly' ? '8,999' : '89,990'}
                  </div>
                  <div className="text-muted-foreground">
                    MXN / {billingPeriod === 'monthly' ? 'mes' : 'año'}
                  </div>
                  {billingPeriod === 'annual' && (
                    <div className="text-sm text-muted-foreground mt-1">
                      Equivale a $7,499/mes
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Hasta 500 propiedades activas</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Hasta 20 agentes incluidos</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Dashboard completo con control de equipo</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Asignación avanzada de propiedades y rendimiento</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Perfiles públicos por agente con catálogo</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Página corporativa premium con tu branding</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Máxima visibilidad y prioridad en resultados</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>40 propiedades destacadas al mes</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Soporte por email</span>
                  </div>
                </div>
                <Button className="w-full" onClick={() => handleSelectPlan('pro')}>
                  Actualizar a Pro
                </Button>
              </CardContent>
            </Card>
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
