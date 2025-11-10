import { useState } from 'react';
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
import { Check, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const PricingInmobiliaria = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAnnual, setIsAnnual] = useState(false);

  const plans = [
    {
      id: 'inmobiliaria-start',
      name: 'Inmobiliaria Start',
      monthlyPrice: 5900,
      annualPrice: 62352,
      annualMonthlyEquivalent: 5196,
      features: [
        'Hasta 5 agentes',
        'Pool de 50 propiedades activas (no caducan mientras se renueven cada 30 días)',
        'Sitio inmobiliaria',
        'Página individual por agente',
        'Ruteo automático de leads',
      ],
      popular: false,
    },
    {
      id: 'inmobiliaria-grow',
      name: 'Inmobiliaria Grow',
      monthlyPrice: 9900,
      annualPrice: 104544,
      annualMonthlyEquivalent: 8712,
      features: [
        'Hasta 10 agentes',
        'Pool de 120 propiedades activas (no caducan mientras se renueven cada 30 días)',
        'Métricas y rendimiento del equipo',
        'Visibilidad prioritaria',
        'Todo lo incluido en Start',
      ],
      popular: true,
    },
    {
      id: 'inmobiliaria-pro',
      name: 'Inmobiliaria Pro',
      monthlyPrice: 15900,
      annualPrice: 167616,
      annualMonthlyEquivalent: 13968,
      features: [
        'Hasta 20 agentes',
        'Pool de 250 propiedades activas (no caducan mientras se renueven cada 30 días)',
        'Roles y permisos',
        'Visibilidad preferencial',
        'Acompañamiento dedicado',
        'Todo lo incluido en Grow',
      ],
      popular: false,
    },
  ];

  const handleSelectPlan = (planId: string) => {
    if (!user) {
      navigate('/auth?redirect=/pricing-inmobiliaria');
      return;
    }

    toast({
      title: 'Plan seleccionado',
      description: 'Contacta con nosotros para activar tu suscripción.',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <DynamicBreadcrumbs
          items={[
            { label: 'Inicio', href: '/', active: false },
            { label: 'Publicar', href: '/publicar', active: false },
            { label: 'Planes Inmobiliaria', href: '', active: true },
          ]}
          className="mb-4"
        />

        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Elige el plan perfecto para tu inmobiliaria
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Paga mes a mes sin compromiso o ahorra pagando el año completo (opcional).
            </p>

            {/* Toggle */}
            <div className="flex items-center justify-center gap-4">
              <Label htmlFor="billing-toggle" className="text-base">
                Mensual (sin compromiso)
              </Label>
              <Switch
                id="billing-toggle"
                checked={isAnnual}
                onCheckedChange={setIsAnnual}
              />
              <Label htmlFor="billing-toggle" className="text-base font-semibold text-primary">
                Ahorrar 12% (opcional)
              </Label>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Puedes cancelar cuando quieras. El pago anual es opcional solo si deseas ahorrar.
            </p>
          </div>

          {/* Información importante */}
          <Card className="mb-8 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="bg-blue-500 text-white p-2 rounded-lg shrink-0">
                  <Info className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2">
                    Inventario Compartido por Equipo
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                    El pool de propiedades es compartido por todos los agentes de tu inmobiliaria. 
                    Las propiedades no caducan mientras se renueven mensualmente con un clic. 
                    Cuando una propiedad se vende o renta, el slot se libera para publicar otra nueva.
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    <strong>Con rotación normal</strong>, tu equipo puede gestionar significativamente 
                    más propiedades durante el año que el límite de slots activos.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Plans Grid */}
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`relative ${
                  plan.popular ? 'border-primary border-2 shadow-lg' : ''
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-4 py-1">
                      Más Popular
                    </Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <div className="mt-4">
                    {isAnnual ? (
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
                <CardContent>
                  <ul className="space-y-3 mb-6">
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
                    Seleccionar Plan
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Nota de renovación */}
          <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 mb-12">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="bg-amber-500 text-white p-2 rounded-lg shrink-0">
                  <Info className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2">
                    Importante: Sistema de Renovación
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Las propiedades <strong>no se eliminan</strong>. Cada propiedad solo debe 
                    renovarse cada 30 días para mantener la información actualizada. 
                    Si no se renueva, <strong>se pausa</strong>. Se puede <strong>reactivar 
                    con un clic</strong> cuando lo necesites.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* FAQ Section */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-center mb-8">Preguntas Frecuentes</h2>
            <Accordion type="single" collapsible className="w-full space-y-4">
              <AccordionItem value="item-1" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left font-semibold">
                  ¿Cómo funciona el pool de propiedades compartido?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  El pool de propiedades es un inventario compartido por todos los agentes de tu 
                  inmobiliaria. Cada agente puede publicar propiedades hasta alcanzar el límite 
                  total del plan. Por ejemplo, en el plan Start con 50 propiedades activas, 
                  tus 5 agentes pueden distribuirlas según las necesidades del negocio.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left font-semibold">
                  ¿Puedo agregar más agentes después?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Sí, puedes actualizar tu plan en cualquier momento para agregar más agentes. 
                  Si necesitas más de los incluidos en el plan Pro (20 agentes), 
                  contáctanos para una solución personalizada.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left font-semibold">
                  ¿Qué pasa si no renovamos una propiedad en 30 días?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Si no se renueva una propiedad en 30 días, se pausa automáticamente. 
                  Cualquier agente de tu equipo con permisos puede reactivarla con un clic. 
                  Las propiedades no se eliminan, solo se pausan para mantener la información actualizada.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left font-semibold">
                  ¿Cómo funciona el ruteo automático de leads?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Los leads se dirigen automáticamente al agente responsable de cada propiedad. 
                  Puedes configurar reglas personalizadas de distribución de leads y 
                  asignar propiedades a agentes específicos desde el panel de administración.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left font-semibold">
                  ¿Qué incluyen las métricas del equipo?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  En los planes Grow y Pro, obtienes acceso a métricas detalladas de rendimiento: 
                  visualizaciones por agente, tasas de conversión, propiedades más vistas, 
                  tiempo promedio de respuesta a leads, y reportes comparativos del equipo. 
                  Ideal para gestionar y motivar a tu equipo de ventas.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-6" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left font-semibold">
                  ¿Puedo gestionar permisos por agente?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Sí, en el plan Pro incluye roles y permisos personalizados. 
                  Puedes definir qué agentes pueden publicar, editar, eliminar propiedades, 
                  gestionar leads, o acceder a métricas. Esto te da control total sobre 
                  las operaciones de tu inmobiliaria.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-7" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left font-semibold">
                  ¿Qué es el acompañamiento dedicado?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  El plan Pro incluye un gestor de cuenta dedicado que te ayudará con la 
                  configuración inicial, capacitación del equipo, optimización de procesos, 
                  y estará disponible para resolver cualquier duda o necesidad especial. 
                  Es ideal para inmobiliarias que quieren maximizar el uso de la plataforma.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PricingInmobiliaria;
