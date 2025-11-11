import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { DynamicBreadcrumbs } from '@/components/DynamicBreadcrumbs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Check, Info, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTracking } from '@/hooks/useTracking';

const PricingDesarrolladora = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pricingPeriod, setPricingPeriod] = useState<'monthly' | 'annual'>('annual');
  const { trackEvent } = useTracking();

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

  const features = [
    '600+ propiedades por proyecto',
    'Landing por torre o desarrollo',
    'Calificación de leads y reporte semanal',
    'Herramientas de gestión empresarial',
    'Soporte prioritario dedicado',
    'Personalización de marca completa',
  ];

  const handleContact = async () => {
    if (!user) {
      navigate('/auth?redirect=/pricing-desarrolladora');
      return;
    }

    // Track Facebook Pixel: Lead
    trackEvent('Lead', {
      content_name: 'Plan Desarrolladora',
      content_category: 'enterprise_inquiry',
      value: 18000,
      currency: 'MXN',
    });

    try {
      toast({
        title: 'Procesando...',
        description: 'Redirigiendo a contacto con ventas.',
      });

      const { supabase } = await import('@/integrations/supabase/client');
      
      // For developer plan, we create a special contact request
      // You can implement a custom flow here or use a specific plan ID
      // For now, we'll show a contact form or redirect
      
      toast({
        title: 'Contactar ventas',
        description: 'Te contactaremos pronto para discutir tu proyecto.',
      });
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
            { label: 'Plan Desarrolladora', href: '', active: true },
          ]}
          className="mb-4"
        />

        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Plan para Desarrolladoras
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Solución completa para promocionar tus proyectos inmobiliarios.
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
                      Anual -14%
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-semibold mb-2">Ahorro con pago anual:</p>
                    <p className="text-sm">$30,240 MXN</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
            <p className="text-sm text-muted-foreground mt-4">
              Puedes cancelar cuando quieras. El pago anual es opcional solo si deseas ahorrar.
            </p>
          </div>

          {/* Main Plan Card */}
          <Card className="mb-8 border-primary border-2 shadow-xl">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl mb-4">Desarrolladora</CardTitle>
              <div className="space-y-2">
                {pricingPeriod === 'annual' ? (
                  <>
                    <div className="text-4xl font-bold text-primary">
                      $185,760
                    </div>
                    <p className="text-lg text-muted-foreground">
                      Pago adelantado (equivale a $15,480/mes)
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-4xl font-bold text-primary">
                      Desde $18,000
                    </div>
                    <p className="text-lg text-muted-foreground">por mes</p>
                  </>
                )}
                <p className="text-sm text-muted-foreground">
                  Precio personalizado según el alcance de tu proyecto
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Features List */}
                <div>
                  <h3 className="font-semibold text-lg mb-4">Características incluidas:</h3>
                  <ul className="space-y-3">
                    {features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-base">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Important Notice */}
                <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm">
                        <strong>Importante:</strong> La pauta/publicidad la paga la desarrolladora 
                        (no está incluida en el precio del plan).
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* CTA Button */}
                <Button 
                  className="w-full h-12 text-lg" 
                  size="lg"
                  onClick={handleContact}
                >
                  Contactar con Ventas
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Additional Info Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-500 text-white p-2 rounded-lg shrink-0">
                    <Info className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-base mb-2">
                      Solución Escalable
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Gestiona múltiples proyectos simultáneamente con landing pages 
                      personalizadas para cada torre o fraccionamiento.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-500 text-white p-2 rounded-lg shrink-0">
                    <Info className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-base mb-2">
                      Análisis de Leads
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Recibe reportes semanales con calificación de leads y métricas 
                      detalladas del rendimiento de tus propiedades.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contact Info */}
          <Card className="mb-12">
            <CardHeader>
              <CardTitle>¿Listo para empezar?</CardTitle>
              <CardDescription>
                Nuestro equipo de ventas te ayudará a diseñar la solución perfecta para tu proyecto.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  El plan para desarrolladoras es completamente personalizable según las 
                  necesidades de tu proyecto. Contáctanos para una cotización detallada.
                </p>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={handleContact}
                >
                  Solicitar Cotización
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* FAQ Section */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-center mb-8">Preguntas Frecuentes</h2>
            <Accordion type="single" collapsible className="w-full space-y-4">
              <AccordionItem value="item-1" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left font-semibold">
                  ¿Qué incluye el landing por torre o desarrollo?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Cada torre o fraccionamiento tendrá su propia landing page personalizada con 
                  la identidad de tu proyecto, galería de imágenes, ubicación, amenidades, 
                  plantas disponibles, y formulario de contacto integrado. Todo optimizado 
                  para conversión de leads.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left font-semibold">
                  ¿Cómo funciona la calificación de leads?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Utilizamos un sistema de scoring que evalúa el comportamiento de cada lead: 
                  páginas visitadas, tiempo en el sitio, propiedades consultadas, formularios 
                  completados, etc. Esto te permite priorizar a los prospectos más interesados 
                  y optimizar el trabajo de tu equipo de ventas.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left font-semibold">
                  ¿Los reportes semanales qué información incluyen?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Recibirás reportes semanales con: número de leads generados, calificación 
                  de cada lead, propiedades más consultadas, tasas de conversión, origen del 
                  tráfico, y recomendaciones de optimización. Todo presentado en formato 
                  ejecutivo fácil de compartir con tu equipo.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left font-semibold">
                  ¿El precio incluye la pauta publicitaria?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  No, el precio del plan cubre la plataforma, landing pages, gestión de leads, 
                  y reportes. La pauta publicitaria (Facebook Ads, Google Ads, etc.) la paga 
                  directamente la desarrolladora según su presupuesto y estrategia de marketing. 
                  Nosotros podemos asesorarte en la estrategia.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left font-semibold">
                  ¿Puedo gestionar múltiples proyectos?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Sí, el plan permite gestionar múltiples proyectos simultáneamente. 
                  Cada proyecto puede tener sus propias landing pages, inventario de unidades, 
                  y tracking de leads independiente. Ideal para desarrolladoras con varios 
                  proyectos en diferentes ubicaciones.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-6" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left font-semibold">
                  ¿Qué es la personalización de marca completa?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Incluye la aplicación de tu identidad corporativa en todas las landing pages: 
                  colores, tipografías, logos, y estilo visual. También puedes tener un dominio 
                  personalizado para cada proyecto (ej: tudesarrollo.com) y branded email marketing.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-7" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left font-semibold">
                  ¿Cómo funciona el soporte prioritario dedicado?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Tendrás un gerente de cuenta exclusivo disponible por WhatsApp, email, y 
                  videollamadas. Te ayudará con configuración de campañas, optimización de 
                  conversión, capacitación del equipo, y resolución inmediata de cualquier 
                  incidencia. Respuesta garantizada en menos de 2 horas hábiles.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PricingDesarrolladora;
