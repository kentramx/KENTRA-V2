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
          <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
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
        </div>
      </main>
    </div>
  );
};

export default PricingInmobiliaria;
