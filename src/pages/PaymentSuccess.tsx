import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Loader2, ArrowRight, Calendar, CreditCard, Plus, Settings, Home, Sparkles, Rocket, XCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTracking } from '@/hooks/useTracking';
import { useSubscription } from '@/contexts/SubscriptionContext';

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
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [failureReason, setFailureReason] = useState<string>('');
  const { trackEvent } = useTracking();
  const { refetch: refetchSubscription } = useSubscription();

  useEffect(() => {
    const payment = searchParams.get('payment');
    const sessionId = searchParams.get('session_id');
    const type = searchParams.get('type');
    
    // Aceptar tanto payment=success como session_id presente
    const isSuccess = payment === 'success' || !!sessionId;
    
    if (!isSuccess) {
      navigate('/');
      return;
    }

    if (!user) {
      navigate('/auth');
      return;
    }

    // Refetch subscription context
    refetchSubscription();

    // Si es compra de upsell, redirigir directamente al dashboard después de un momento
    if (type === 'upsell') {
      setTimeout(() => {
        setLoading(false);
      }, 1500);
    } else {
      // Si tenemos session_id, verificar el estado del pago
      if (sessionId) {
        verifyPaymentSession(sessionId);
      } else {
        fetchSubscription();
      }
    }
  }, [user, searchParams, navigate, refetchSubscription]);

  const verifyPaymentSession = async (sessionId: string) => {
    try {
      // Esperar un momento para que el webhook procese
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Intentar obtener la suscripción
      await fetchSubscription();
      
    } catch (error) {
      console.error('Error verifying payment session:', error);
      setPaymentFailed(true);
      setFailureReason('No pudimos verificar el estado de tu pago. Por favor contacta soporte.');
      setLoading(false);
    }
  };

  const fetchSubscription = async () => {
    if (!user) return;

    try {
      // Obtener la suscripción activa del usuario
      const { data: userSub, error: subError } = await supabase
        .from('user_subscriptions')
        .select('*, plan:subscription_plans(*)')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing', 'incomplete'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError) throw subError;

      // Si el pago está incompleto (OXXO/SPEI pendiente)
      if (userSub?.status === 'incomplete') {
        setPaymentFailed(true);
        setFailureReason('Tu pago está pendiente de confirmación. Recibirás un correo cuando se complete.');
        setLoading(false);
        return;
      }

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

  const getPlanTypeFromName = (planName?: string): string => {
    if (!planName) return 'agente';
    if (planName.includes('inmobiliaria')) return 'inmobiliaria';
    if (planName.includes('desarrolladora')) return 'desarrolladora';
    return 'agente';
  };

  const getPricingRoute = () => {
    const planType = getPlanTypeFromName(subscription?.planName);
    return `/pricing-${planType}`;
  };

  const handlePublishProperty = () => {
    // Determinar a qué dashboard redirigir según el plan
    if (subscription?.planName.includes('inmobiliaria')) {
      navigate('/panel-inmobiliaria?tab=inventory');
    } else if (subscription?.planName.includes('desarrolladora')) {
      navigate('/panel-desarrolladora?tab=projects');
    } else {
      navigate('/panel-agente?tab=form');
    }
  };

  const handleGoToDashboard = () => {
    // Determinar a qué dashboard redirigir según el plan
    if (subscription?.planName.includes('inmobiliaria')) {
      navigate('/panel-inmobiliaria');
    } else if (subscription?.planName.includes('desarrolladora')) {
      navigate('/panel-desarrolladora');
    } else {
      navigate('/panel-agente');
    }
  };

  const getServicesRoute = () => {
    if (subscription?.planName.includes('inmobiliaria')) {
      return '/panel-inmobiliaria?tab=subscription';
    } else if (subscription?.planName.includes('desarrolladora')) {
      return '/panel-desarrolladora?tab=subscription';
    }
    return '/panel-agente?tab=subscription';
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
              <Button size="lg" onClick={() => navigate(getServicesRoute())}>
                Ver Mis Servicios
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Si el pago falló o está pendiente
  if (paymentFailed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        <Navbar />
        <main className="container mx-auto px-4 py-16">
          <div className="max-w-xl mx-auto">
            <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-yellow-100 mb-6">
                <XCircle className="h-14 w-14 text-yellow-600" />
              </div>
              <h1 className="text-3xl font-bold text-foreground mb-4">
                Pago pendiente
              </h1>
              <p className="text-lg text-muted-foreground mb-6">
                {failureReason}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button size="lg" onClick={() => navigate(getPricingRoute())}>
                  <RefreshCw className="h-5 w-5 mr-2" />
                  Intentar de nuevo
                </Button>
                <Button variant="outline" size="lg" onClick={() => navigate('/')}>
                  Ir al inicio
                </Button>
              </div>
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
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                Estamos procesando tu pago. Esto puede tomar unos segundos...
              </p>
              <p className="text-xs text-muted-foreground">
                Si el problema persiste, contacta con soporte.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const nextSteps = [
    {
      icon: Plus,
      title: 'Publica tu primera propiedad',
      description: 'Comienza a atraer clientes potenciales',
      action: handlePublishProperty,
      primary: true,
    },
    {
      icon: Settings,
      title: 'Completa tu perfil',
      description: 'Un perfil completo genera más confianza',
      action: () => navigate('/perfil'),
      primary: false,
    },
    {
      icon: Home,
      title: 'Ir al Dashboard',
      description: 'Ve el resumen de tu cuenta',
      action: handleGoToDashboard,
      primary: false,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <Navbar />

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          {/* Success Animation */}
          <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-100 mb-6 animate-in zoom-in duration-300">
              <CheckCircle2 className="h-14 w-14 text-green-600" />
            </div>
            <div className="flex items-center justify-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              <h1 className="text-4xl font-bold text-foreground">
                ¡Bienvenido a Kentra!
              </h1>
              <Sparkles className="h-5 w-5 text-yellow-500" />
            </div>
            <p className="text-xl text-muted-foreground">
              Tu suscripción ha sido activada correctamente
            </p>
          </div>

          {/* Plan Info Card */}
          {subscription?.planDisplayName && (
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4 mb-6 animate-in fade-in slide-in-from-left duration-500 delay-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{subscription.planDisplayName}</p>
                  <p className="text-sm text-muted-foreground">
                    {subscription.billingCycle === 'yearly' ? 'Plan Anual' : 'Plan Mensual'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Subscription Details Card */}
          <Card className="mb-8 border-2 border-green-200 shadow-lg animate-in fade-in slide-in-from-bottom duration-500 delay-300">
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

          {/* Next Steps */}
          <div className="space-y-3 mb-8 animate-in fade-in slide-in-from-bottom duration-500 delay-500">
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Rocket className="h-4 w-4" />
              Próximos pasos
            </p>
            
            {nextSteps.map((step, index) => (
              <Button
                key={step.title}
                variant={step.primary ? 'default' : 'outline'}
                className="w-full justify-start h-auto py-4 animate-in fade-in slide-in-from-bottom duration-300"
                style={{ animationDelay: `${600 + index * 100}ms` }}
                onClick={step.action}
              >
                <step.icon className={`h-5 w-5 mr-3 ${step.primary ? '' : 'text-muted-foreground'}`} />
                <div className="text-left flex-1">
                  <p className="font-medium">{step.title}</p>
                  <p className={`text-xs ${step.primary ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                    {step.description}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ))}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Recibirás un correo de confirmación con los detalles de tu suscripción.
          </p>
        </div>
      </main>
    </div>
  );
};

export default PaymentSuccess;
