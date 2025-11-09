import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { DynamicBreadcrumbs } from '@/components/DynamicBreadcrumbs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Plan {
  id: string;
  name: string;
  display_name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  category: 'agent' | 'agency' | 'developer';
  features: string[];
  is_popular?: boolean;
  custom_price?: boolean;
}

const PLANS: Plan[] = [
  // PLANES PARA AGENTES
  {
    id: 'agent-basic',
    name: 'basic',
    display_name: 'Agente Básico',
    description: 'Ideal para iniciar tu carrera',
    price_monthly: 299,
    price_yearly: 3150,
    category: 'agent',
    features: [
      'Hasta 4 propiedades activas',
      'Renovación sin caducar',
      'Página básica',
      'Leads directo a WhatsApp',
      '1 propiedad destacada al mes'
    ],
  },
  {
    id: 'agent-pro',
    name: 'pro',
    display_name: 'Agente Pro',
    description: 'Para agentes profesionales',
    price_monthly: 799,
    price_yearly: 8430,
    category: 'agent',
    is_popular: true,
    features: [
      'Hasta 10 propiedades activas',
      'Página profesional',
      'Autopublicación Facebook e Instagram',
      'Leads directo a WhatsApp',
      '3 propiedades destacadas al mes'
    ],
  },
  {
    id: 'agent-elite',
    name: 'elite',
    display_name: 'Agente Elite',
    description: 'Presencia premium en el mercado',
    price_monthly: 1350,
    price_yearly: 14256,
    category: 'agent',
    features: [
      'Hasta 20 propiedades activas',
      'Presencia premium + branding',
      'Autopublicación optimizada',
      '6 propiedades destacadas al mes',
      'Prioridad en visibilidad'
    ],
  },
  // PLANES PARA INMOBILIARIAS
  {
    id: 'agency-start',
    name: 'start',
    display_name: 'Inmobiliaria Start',
    description: 'Para equipos pequeños',
    price_monthly: 5900,
    price_yearly: 62352,
    category: 'agency',
    features: [
      'Hasta 5 agentes',
      '50 propiedades activas',
      'Inventario en pool compartido',
      'Sitio inmobiliaria',
      'Páginas por agente',
      'Ruteo de leads'
    ],
  },
  {
    id: 'agency-grow',
    name: 'grow',
    display_name: 'Inmobiliaria Grow',
    description: 'Para inmobiliarias en crecimiento',
    price_monthly: 9900,
    price_yearly: 104544,
    category: 'agency',
    is_popular: true,
    features: [
      'Hasta 10 agentes',
      '120 propiedades activas',
      'Inventario en pool compartido',
      'Métricas de equipo',
      'Prioridad de visibilidad',
      'Dashboard colaborativo'
    ],
  },
  {
    id: 'agency-pro',
    name: 'agency-pro',
    display_name: 'Inmobiliaria Pro',
    description: 'Solución empresarial completa',
    price_monthly: 15900,
    price_yearly: 167616,
    category: 'agency',
    features: [
      'Hasta 20 agentes',
      '250 propiedades activas',
      'Roles y permisos',
      'Visibilidad preferencial',
      'Acompañamiento dedicado',
      'Reportes personalizados'
    ],
  },
  // PLAN DESARROLLADORA
  {
    id: 'developer',
    name: 'developer',
    display_name: 'Desarrolladora',
    description: 'Proyectos de gran escala',
    price_monthly: 18000,
    price_yearly: 0,
    category: 'developer',
    custom_price: true,
    features: [
      '600+ propiedades por proyecto',
      'Landing por torre',
      'Campañas personalizadas',
      'Reporte semanal',
      'La pauta/publicidad la paga la desarrolladora',
      'Gestor de cuenta dedicado'
    ],
  },
];

const Pricing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [isYearly, setIsYearly] = useState(false);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  const actionParam = searchParams.get('action');

  const handleSelectPlan = async (plan: Plan) => {
    if (!user) {
      navigate(`/auth?redirect=/pricing`);
      return;
    }

    if (plan.custom_price) {
      toast({
        title: 'Plan Personalizado',
        description: 'Contáctanos para obtener una cotización personalizada',
      });
      return;
    }

    setProcessingPlan(plan.id);

    try {
      toast({
        title: 'Próximamente',
        description: 'La integración de pagos estará disponible pronto',
      });
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
    if (plan.custom_price) return 'Desde $18,000/mes';
    return `$${plan.price_monthly.toLocaleString('es-MX')}/mes`;
  };

  const getYearlyPriceDisplay = (plan: Plan) => {
    if (plan.price_yearly === 0 || plan.custom_price) return null;
    const monthlyEquivalent = Math.round(plan.price_yearly / 12);
    return {
      total: plan.price_yearly.toLocaleString('es-MX'),
      monthly: monthlyEquivalent.toLocaleString('es-MX')
    };
  };

  const getPlanSavings = (plan: Plan) => {
    if (plan.price_yearly === 0 || plan.custom_price) return null;
    const monthlyCost = plan.price_monthly * 12;
    const savings = ((monthlyCost - plan.price_yearly) / monthlyCost) * 100;
    return savings > 0 ? Math.round(savings) : null;
  };

  // Agrupar planes por categoría
  const agentPlans = PLANS.filter(p => p.category === 'agent');
  const agencyPlans = PLANS.filter(p => p.category === 'agency');
  const developerPlans = PLANS.filter(p => p.category === 'developer');

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

          {/* Planes para Agentes */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-6">Planes para Agentes</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {agentPlans.map((plan) => {
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
                        Más Popular
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
                          </>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent>
                      <ul className="space-y-3">
                        {plan.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                            <span className="text-sm">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>

                    <CardFooter>
                      <Button
                        className="w-full"
                        variant={plan.is_popular ? 'default' : 'outline'}
                        onClick={() => handleSelectPlan(plan)}
                        disabled={processingPlan === plan.id || !user}
                      >
                        {!user ? 'Iniciar sesión' : 'Seleccionar plan'}
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Planes para Inmobiliarias */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-6">Planes para Inmobiliarias</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {agencyPlans.map((plan) => {
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
                        Más Popular
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
                          </>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent>
                      <ul className="space-y-3">
                        {plan.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                            <span className="text-sm">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>

                    <CardFooter>
                      <Button
                        className="w-full"
                        variant={plan.is_popular ? 'default' : 'outline'}
                        onClick={() => handleSelectPlan(plan)}
                        disabled={processingPlan === plan.id || !user}
                      >
                        {!user ? 'Iniciar sesión' : 'Seleccionar plan'}
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Plan Desarrolladora */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-6">Plan Desarrolladora</h2>
            <div className="max-w-md mx-auto">
              {developerPlans.map((plan) => (
                <Card key={plan.id} className="border-primary shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-2xl">{plan.display_name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                    <div className="mt-4">
                      <div className="text-4xl font-bold text-foreground">
                        {getPlanPrice(plan)}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Precio personalizado según proyecto
                      </p>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <ul className="space-y-3">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>

                  <CardFooter>
                    <Button
                      className="w-full"
                      variant="default"
                      onClick={() => handleSelectPlan(plan)}
                    >
                      Contactar para cotización
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
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
