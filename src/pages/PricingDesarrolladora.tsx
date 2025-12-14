import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { startSubscriptionCheckout, getCurrentSubscription } from '@/utils/stripeCheckout';
import Navbar from '@/components/Navbar';
import { CouponInput } from '@/components/CouponInput';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Building2, MapPin, BarChart3, Users, FileText, Award } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Label } from '@/components/ui/label';

const PricingDesarrolladora = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);

  const scrollToPlans = () => {
    document.getElementById('planes')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSelectPlan = async (planSlug: string) => {
    if (!user) {
      navigate('/auth?redirect=/pricing-desarrolladora');
      return;
    }

    try {
      // Verificar si ya tiene suscripción
      const { subscription } = await getCurrentSubscription();
      if (subscription) {
        toast.error('Ya tienes una suscripción activa. Ve a tu dashboard para gestionarla.');
        navigate('/panel-desarrolladora');
        return;
      }

      // Iniciar checkout con el nuevo sistema (incluye cupón si está aplicado)
      const billingCycleValue = billingCycle === 'monthly' ? 'monthly' : 'yearly';
      const result = await startSubscriptionCheckout(`desarrolladora_${planSlug}`, billingCycleValue, appliedCoupon || undefined);

      if (!result.success) {
        toast.error(result.error || 'Error al iniciar el proceso de pago');
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
        <h1 className="text-4xl md:text-5xl font-bold mb-6">Planes para Desarrolladoras</h1>
        <p className="text-muted-foreground text-lg md:text-xl max-w-3xl mx-auto mb-8">
          Promociona tus proyectos, genera leads calificados y posiciona tu marca con la visibilidad que solo Kentra ofrece.
        </p>
        <Button size="lg" onClick={scrollToPlans}>
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

      {/* Plans Section */}
      <section id="planes" className="container mx-auto px-4 py-16 scroll-mt-20">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-md mx-auto mb-8">
            <CouponInput 
              onCouponApplied={setAppliedCoupon}
              planType="developer"
            />
          </div>
          
          {/* Billing Toggle */}
          <div className="flex justify-center items-center gap-4 mb-12">
            <Label 
              className={billingCycle === 'monthly' ? 'font-semibold' : 'text-muted-foreground'}
            >
              Mensual
            </Label>
            <button
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                billingCycle === 'annual' ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                  billingCycle === 'annual' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <Label 
              className={billingCycle === 'annual' ? 'font-semibold' : 'text-muted-foreground'}
            >
              Anual <Badge variant="secondary" className="ml-2">-17%</Badge>
            </Label>
          </div>

          {/* Plan Cards */}
          <div className="grid md:grid-cols-3 gap-8">
            {/* Start Plan */}
            <Card>
              <CardHeader>
                <CardTitle>Desarrolladora Start</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-foreground">
                    ${billingCycle === 'monthly' ? '5,990' : '59,900'}
                  </span>
                  <span className="text-muted-foreground"> MXN</span>
                  {billingCycle === 'annual' && (
                    <span className="block text-sm mt-1">
                      equivale a $4,992/mes
                    </span>
                  )}
                  <span className="block text-sm mt-1">
                    {billingCycle === 'monthly' ? 'por mes' : 'por año'}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex gap-2">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-sm">1 proyecto activo</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-sm">Micrositio del desarrollo (galería, mapa, contacto)</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-sm">Leads directos a WhatsApp</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-sm">Dashboard con métricas de vistas y contactos</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-sm">Página corporativa con logotipo y descripción</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-sm">Visibilidad estándar en listados</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-sm">Soporte por email</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => handleSelectPlan('start')}
                >
                  Comenzar con Start
                </Button>
              </CardFooter>
            </Card>

            {/* Grow Plan - Más elegido */}
            <Card className="border-primary shadow-lg relative">
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Más elegido</Badge>
              <CardHeader>
                <CardTitle>Desarrolladora Grow</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-foreground">
                    ${billingCycle === 'monthly' ? '12,900' : '129,000'}
                  </span>
                  <span className="text-muted-foreground"> MXN</span>
                  {billingCycle === 'annual' && (
                    <span className="block text-sm mt-1">
                      equivale a $10,750/mes
                    </span>
                  )}
                  <span className="block text-sm mt-1">
                    {billingCycle === 'monthly' ? 'por mes' : 'por año'}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex gap-2">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-sm">Hasta 3 proyectos activos</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-sm">Micrositio para cada desarrollo con galería multimedia</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-sm">Estadísticas completas por proyecto y contacto</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-sm">Dashboard de administración de leads y unidades</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-sm">Página corporativa con banner y branding</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-sm">Visibilidad alta en resultados y portada</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-sm">Publicación destacada mensual incluida</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-sm">Reporte de rendimiento mensual</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-sm">Soporte por chat prioritario</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full"
                  onClick={() => handleSelectPlan('grow')}
                >
                  Continuar con Grow
                </Button>
              </CardFooter>
            </Card>

            {/* Pro Plan */}
            <Card>
              <CardHeader>
                <CardTitle>Desarrolladora Pro</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-foreground">
                    ${billingCycle === 'monthly' ? '24,900' : '249,000'}
                  </span>
                  <span className="text-muted-foreground"> MXN</span>
                  {billingCycle === 'annual' && (
                    <span className="block text-sm mt-1">
                      equivale a $20,750/mes
                    </span>
                  )}
                  <span className="block text-sm mt-1">
                    {billingCycle === 'monthly' ? 'por mes' : 'por año'}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex gap-2">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-sm">Hasta 6 proyectos activos</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-sm">Micrositios personalizados con branding completo</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-sm">Estadísticas avanzadas y reporte de rendimiento mensual</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-sm">Inclusión mensual en portada y newsletter nacional</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-sm">Dashboard con métricas de origen de leads</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-sm">Máxima visibilidad y posicionamiento de marca</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-sm">Asesor comercial dedicado</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => handleSelectPlan('pro')}
                >
                  Actualizar a Pro
                </Button>
              </CardFooter>
            </Card>
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
