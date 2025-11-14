import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, ArrowUpCircle, Calendar } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PlanStatusCardProps {
  subscriptionInfo: {
    plan_name: string;
    plan_display_name: string;
    properties_used: number;
    properties_limit: number;
    featured_used: number;
    featured_limit: number;
    current_period_end: string;
    status: string;
    features: {
      max_properties: number;
      featured_listings: number;
      autopublicacion?: boolean;
      reportes_avanzados?: boolean;
      gestion_equipo?: boolean;
      landing_pages?: boolean;
      soporte_prioritario?: boolean;
    };
  } | null;
  userRole: string;
}

export const PlanStatusCard = ({ subscriptionInfo, userRole }: PlanStatusCardProps) => {
  const navigate = useNavigate();

  if (!subscriptionInfo) {
    return (
      <Card className="border-destructive bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Sin Plan Activo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Necesitas una suscripción activa para publicar propiedades como agente.
          </p>
          <Button 
            onClick={() => navigate(userRole === 'agency' ? '/pricing-inmobiliaria' : '/pricing-agente')}
            className="w-full"
          >
            Ver Planes Disponibles
          </Button>
        </CardContent>
      </Card>
    );
  }

  const propertiesPercentage = subscriptionInfo.properties_limit === -1 
    ? 0 
    : (subscriptionInfo.properties_used / subscriptionInfo.properties_limit) * 100;
  
  const featuredPercentage = subscriptionInfo.featured_limit === 0 
    ? 0 
    : (subscriptionInfo.featured_used / subscriptionInfo.featured_limit) * 100;

  const isNearLimit = propertiesPercentage >= 80 && subscriptionInfo.properties_limit !== -1;
  const periodEnd = new Date(subscriptionInfo.current_period_end);
  const daysUntilRenewal = Math.ceil((periodEnd.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  const isNearRenewal = daysUntilRenewal <= 7;

  // Determinar estado visual según status
  const getStatusInfo = () => {
    switch (subscriptionInfo.status) {
      case 'active':
        return { variant: 'default' as const, label: 'Activo', showAlert: false };
      case 'trialing':
        return { variant: 'secondary' as const, label: `Prueba (${daysUntilRenewal} días)`, showAlert: true, alertMessage: `Tu período de prueba termina en ${daysUntilRenewal} días. Asegúrate de tener un método de pago válido.`, alertType: 'info' };
      case 'past_due':
        return { variant: 'destructive' as const, label: 'Pago Pendiente', showAlert: true, alertMessage: 'Hay un problema con tu pago. Actualiza tu método de pago para no perder acceso.', alertType: 'destructive' };
      case 'canceled':
        return { variant: 'secondary' as const, label: 'Cancelado', showAlert: true, alertMessage: `Tu suscripción termina el ${format(periodEnd, "d 'de' MMMM", { locale: es })}. Después de esta fecha perderás acceso.`, alertType: 'warning' };
      default:
        return { variant: 'secondary' as const, label: subscriptionInfo.status, showAlert: false };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="space-y-4">
      {/* Alerta de estado si es necesario */}
      {statusInfo.showAlert && (
        <Alert variant={statusInfo.alertType as any}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{statusInfo.alertMessage}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Plan {subscriptionInfo.plan_display_name}
                <Badge variant={statusInfo.variant}>
                  {statusInfo.label}
                </Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Renovación: {format(periodEnd, "d 'de' MMMM, yyyy", { locale: es })}
                {isNearRenewal && (
                  <Badge variant="secondary" className="ml-2">
                    {daysUntilRenewal} días restantes
                  </Badge>
                )}
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate(userRole === 'agency' ? '/pricing-inmobiliaria' : '/pricing-agente')}
              className="gap-2"
            >
              <ArrowUpCircle className="h-4 w-4" />
              Mejorar Plan
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Propiedades Activas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Propiedades Activas</span>
              <span className="text-muted-foreground">
                {subscriptionInfo.properties_limit === -1 
                  ? `${subscriptionInfo.properties_used} / Ilimitadas`
                  : `${subscriptionInfo.properties_used} / ${subscriptionInfo.properties_limit}`
                }
              </span>
            </div>
            {subscriptionInfo.properties_limit !== -1 && (
              <Progress value={propertiesPercentage} className="h-2" />
            )}
          </div>

          {/* Propiedades Destacadas */}
          {subscriptionInfo.featured_limit > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Propiedades Destacadas</span>
                <span className="text-muted-foreground">
                  {subscriptionInfo.featured_used} / {subscriptionInfo.featured_limit}
                </span>
              </div>
              <Progress value={featuredPercentage} className="h-2" />
            </div>
          )}

          {/* Características del Plan */}
          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-3">Características incluidas:</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {subscriptionInfo.features.autopublicacion && (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span>Autopublicación</span>
                </div>
              )}
              {subscriptionInfo.features.reportes_avanzados && (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span>Reportes Avanzados</span>
                </div>
              )}
              {subscriptionInfo.features.gestion_equipo && (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span>Gestión de Equipo</span>
                </div>
              )}
              {subscriptionInfo.features.landing_pages && (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span>Landing Pages</span>
                </div>
              )}
              {subscriptionInfo.features.soporte_prioritario && (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span>Soporte Prioritario</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alertas */}
      {isNearLimit && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Estás cerca del límite de propiedades de tu plan ({subscriptionInfo.properties_used} de {subscriptionInfo.properties_limit}).
            {' '}
            <Button 
              variant="link" 
              className="p-0 h-auto font-semibold text-destructive-foreground underline"
              onClick={() => navigate(userRole === 'agency' ? '/pricing-inmobiliaria' : '/pricing-agente')}
            >
              Mejora a {subscriptionInfo.plan_name === 'basico' ? 'Pro' : 'Elite'} para más propiedades
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isNearRenewal && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Tu plan se renovará automáticamente en {daysUntilRenewal} días ({format(periodEnd, "d 'de' MMMM", { locale: es })})
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};