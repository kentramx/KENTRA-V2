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

const PricingAgente = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAnnual, setIsAnnual] = useState(false);

  const plans = [
    {
      id: 'agente-basico',
      name: 'Agente Básico',
      monthlyPrice: 299,
      annualPrice: 3150,
      annualMonthlyEquivalent: 262,
      features: [
        'Hasta 4 propiedades activas (no caducan mientras se renueven cada 30 días)',
        'Página básica',
        'Leads directo a WhatsApp',
        '1 propiedad destacada al mes',
      ],
      popular: false,
    },
    {
      id: 'agente-pro',
      name: 'Agente Pro',
      monthlyPrice: 799,
      annualPrice: 8430,
      annualMonthlyEquivalent: 703,
      features: [
        'Hasta 10 propiedades activas (no caducan mientras se renueven cada 30 días)',
        'Página profesional',
        'Autopublicación a Facebook e Instagram',
        'Leads directo a WhatsApp',
        '3 propiedades destacadas al mes',
      ],
      popular: true,
    },
    {
      id: 'agente-elite',
      name: 'Agente Elite',
      monthlyPrice: 1350,
      annualPrice: 14256,
      annualMonthlyEquivalent: 1188,
      features: [
        'Hasta 20 propiedades activas (no caducan mientras se renueven cada 30 días)',
        'Branding premium + visibilidad prioritaria',
        'Autopublicación optimizada',
        '6 propiedades destacadas al mes',
        'Prioridad en búsquedas',
      ],
      popular: false,
    },
  ];

  const handleSelectPlan = (planId: string) => {
    if (!user) {
      navigate('/auth?redirect=/pricing-agente');
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
            { label: 'Planes Agente', href: '', active: true },
          ]}
          className="mb-4"
        />

        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Elige el plan perfecto para ti
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
                    Sistema de Propiedades Activas Simultáneas
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                    Los planes ofrecen <strong>propiedades activas simultáneas</strong> (slots), 
                    no un límite total de publicaciones. Las propiedades no caducan mientras se 
                    renueven mensualmente con un clic. Cuando se vende o renta una propiedad, 
                    el slot se libera y puedes publicar otra nueva.
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    <strong>Con rotación normal</strong>, un agente con plan de 4 propiedades 
                    activas podría publicar 20-30+ propiedades durante un año.
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

export default PricingAgente;
