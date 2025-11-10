import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { DynamicBreadcrumbs } from '@/components/DynamicBreadcrumbs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Info, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const PricingDesarrolladora = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const features = [
    '600+ propiedades por proyecto',
    'Landing por torre o desarrollo',
    'Calificación de leads y reporte semanal',
    'Herramientas de gestión empresarial',
    'Soporte prioritario dedicado',
    'Personalización de marca completa',
  ];

  const handleContact = () => {
    if (!user) {
      navigate('/auth?redirect=/pricing-desarrolladora');
      return;
    }

    toast({
      title: 'Contactar ventas',
      description: 'Te contactaremos pronto para discutir tu proyecto.',
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
            <p className="text-xl text-muted-foreground">
              Solución completa para promocionar tus proyectos inmobiliarios.
            </p>
          </div>

          {/* Main Plan Card */}
          <Card className="mb-8 border-primary border-2 shadow-xl">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl mb-4">Desarrolladora</CardTitle>
              <div className="space-y-2">
                <div className="text-4xl font-bold text-primary">
                  Desde $18,000
                </div>
                <p className="text-lg text-muted-foreground">por mes</p>
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
          <Card>
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
        </div>
      </main>
    </div>
  );
};

export default PricingDesarrolladora;
