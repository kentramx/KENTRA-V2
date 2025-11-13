import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Loader2, ArrowRight, Calendar, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTracking } from '@/hooks/useTracking';

interface SubscriptionDetails {
  planName: string;
  planDisplayName: string;
  price: number;
  billingCycle: string;
  currentPeriodEnd: string;
  features: any;
  status: string;
}

const PaymentSuccess = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const { trackEvent } = useTracking();

  useEffect(() => {
    const payment = searchParams.get('payment');
    const type = searchParams.get('type');
    
    if (payment !== 'success') {
      navigate('/');
      return;
    }

    if (!user) {
      navigate('/auth');
      return;
    }

    // Si es compra de upsell, redirigir directamente al dashboard después de un momento
    if (type === 'upsell') {
      setTimeout(() => {
        setLoading(false);
      }, 1500);
    } else {
      fetchSubscription();
    }
  }, [user, searchParams, navigate]);

  const fetchSubscription = async () => {
    if (!user) return;

    try {
      // Obtener la suscripción activa del usuario
      const { data: userSub, error: subError } = await supabase
        .from('user_subscriptions')
        .select('*, plan:subscription_plans(*)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (subError) throw subError;

      if (userSub && userSub.plan) {
        const subscriptionData = {
          planName: userSub.plan.name,
          planDisplayName: userSub.plan.display_name,
          price: userSub.billing_cycle === 'yearly' 
            ? Number(userSub.plan.price_yearly) 
            : Number(userSub.plan.price_monthly),
          billingCycle: userSub.billing_cycle,
          currentPeriodEnd: userSub.current_period_end,
          features: userSub.plan.features,
          status: userSub.status,
        };
        
        setSubscription(subscriptionData);

        // Track Facebook Pixel: Purchase
        trackEvent('Purchase', {
          content_name: subscriptionData.planDisplayName,
          content_category: 'subscription',
          value: subscriptionData.price,
          currency: 'MXN',
        });
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoToDashboard = () => {
    // Determinar a qué dashboard redirigir según el plan
    if (subscription?.planName.includes('inmobiliaria')) {
      navigate('/panel-inmobiliaria');
    } else {
      navigate('/panel-agente');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchParams.get('type') === 'upsell' 
                ? 'Procesando tu compra...' 
                : 'Cargando información de tu suscripción...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Si es compra de upsell, mostrar mensaje simple
  if (searchParams.get('type') === 'upsell') {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-16">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-6">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
              <h1 className="text-4xl font-bold text-foreground mb-4">
                ¡Compra exitosa!
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                Tu servicio adicional ha sido activado correctamente
              </p>
              <Button size="lg" onClick={() => navigate('/panel-agente?tab=subscription')}>
                Ver Mis Servicios
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground mb-4">
                No se encontró información de suscripción. Por favor, contacta con soporte.
              </p>
              <Button onClick={() => navigate('/')}>Ir al inicio</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          {/* Success Message */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-6">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-4">
              ¡Pago exitoso!
            </h1>
            <p className="text-xl text-muted-foreground">
              Tu suscripción ha sido activada correctamente
            </p>
          </div>

          {/* Subscription Details Card */}
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">{subscription.planDisplayName}</CardTitle>
                  <CardDescription className="mt-2">
                    Gracias por confiar en nosotros
                  </CardDescription>
                </div>
                <Badge className="bg-green-600 text-white">Activo</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Price Info */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Monto pagado</p>
                    <p className="text-2xl font-bold">
                      ${subscription.price.toLocaleString('es-MX')} MXN
                    </p>
                  </div>
                </div>
                <Badge variant="outline">
                  {subscription.billingCycle === 'yearly' ? 'Anual' : 'Mensual'}
                </Badge>
              </div>

              {/* Renewal Date */}
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <Calendar className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Próxima renovación</p>
                  <p className="font-semibold">
                    {format(new Date(subscription.currentPeriodEnd), "d 'de' MMMM, yyyy", { locale: es })}
                  </p>
                </div>
              </div>

              {/* Features */}
              <div>
                <h3 className="font-semibold mb-3">Características incluidas:</h3>
                <ul className="space-y-2">
                  {subscription.features.max_properties && (
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span>
                        {subscription.features.max_properties === -1
                          ? 'Propiedades ilimitadas'
                          : `Hasta ${subscription.features.max_properties} propiedades activas simultáneas`}
                      </span>
                    </li>
                  )}
                  {subscription.features.featured_listings > 0 && (
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span>
                        {subscription.features.featured_listings === -1
                          ? 'Propiedades destacadas ilimitadas'
                          : `${subscription.features.featured_listings} propiedades destacadas al mes`}
                      </span>
                    </li>
                  )}
                  {subscription.features.max_agents && (
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span>
                        {subscription.features.max_agents === -1
                          ? 'Agentes ilimitados'
                          : `Hasta ${subscription.features.max_agents} agentes`}
                      </span>
                    </li>
                  )}
                  {subscription.features.autopublicacion && (
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span>Autopublicación a redes sociales</span>
                    </li>
                  )}
                  {subscription.features.reportes_avanzados && (
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span>Reportes y análisis avanzados</span>
                    </li>
                  )}
                  {subscription.features.gestion_equipo && (
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span>Gestión de equipo y asignación de propiedades</span>
                    </li>
                  )}
                  {subscription.features.soporte_prioritario && (
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span>Soporte prioritario</span>
                    </li>
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={handleGoToDashboard}
              className="gap-2"
            >
              Ir a mi Dashboard
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/')}
            >
              Volver al inicio
            </Button>
          </div>

          {/* Additional Info */}
          <Card className="mt-8 bg-muted/50">
            <CardContent className="pt-6">
              <p className="text-sm text-center text-muted-foreground">
                Recibirás un correo de confirmación con los detalles de tu suscripción.
                Si tienes alguna pregunta, no dudes en contactarnos.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default PaymentSuccess;
