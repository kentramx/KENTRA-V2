import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Activity, AlertCircle, CheckCircle2, Clock, TrendingDown, TrendingUp, Zap, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { monitoring } from '@/lib/monitoring';

interface SystemHealthMetrics {
  subscriptions: {
    active: number;
    past_due: number;
    canceled: number;
    trialing: number;
    total: number;
  };
  recent_failed_payments: Array<{
    id: string;
    created_at: string;
    amount: number;
    currency: string;
    user_name: string;
    user_email: string;
  }> | null;
  payment_stats_30d: {
    total_attempts: number;
    successful: number;
    failed: number;
    success_rate: number;
  };
  subscription_changes_7d: {
    total: number;
    upgrades: number;
    downgrades: number;
    cancellations: number;
  };
  expiring_soon: number;
}

export const SystemHealthDashboard = () => {
  const [metrics, setMetrics] = useState<SystemHealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSystemHealth();
    
    // Refrescar cada 5 minutos
    const interval = setInterval(() => {
      fetchSystemHealth();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const fetchSystemHealth = async () => {
    try {
      const { data, error } = await supabase.rpc('get_system_health_metrics');
      
      if (error) throw error;
      setMetrics(data as unknown as SystemHealthMetrics);
    } catch (error) {
      console.error('Error fetching system health:', error);
      toast.error('Error al cargar métricas del sistema');
    } finally {
      setLoading(false);
    }
  };

  const getHealthStatus = (): { status: 'healthy' | 'warning' | 'critical'; message: string } => {
    if (!metrics) return { status: 'warning', message: 'Cargando datos...' };

    const failRate = 100 - metrics.payment_stats_30d.success_rate;
    const pastDueCount = metrics.subscriptions.past_due;

    if (failRate > 10 || pastDueCount > 5) {
      return { status: 'critical', message: 'Requiere atención inmediata' };
    }

    if (failRate > 5 || pastDueCount > 2) {
      return { status: 'warning', message: 'Monitoreo recomendado' };
    }

    return { status: 'healthy', message: 'Sistema operando normalmente' };
  };

  const healthStatus = getHealthStatus();

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estado General del Sistema */}
      <Card className={`border-2 ${
        healthStatus.status === 'healthy' ? 'border-green-500' :
        healthStatus.status === 'warning' ? 'border-yellow-500' :
        'border-red-500'
      }`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {healthStatus.status === 'healthy' && <CheckCircle2 className="h-8 w-8 text-green-500" />}
              {healthStatus.status === 'warning' && <AlertCircle className="h-8 w-8 text-yellow-500" />}
              {healthStatus.status === 'critical' && <XCircle className="h-8 w-8 text-red-500" />}
              <div>
                <CardTitle className="text-2xl">Estado del Sistema de Monetización</CardTitle>
                <CardDescription className="text-lg">{healthStatus.message}</CardDescription>
              </div>
            </div>
            <Badge 
              variant={healthStatus.status === 'healthy' ? 'default' : 'destructive'}
              className="text-lg px-4 py-2"
            >
              {healthStatus.status === 'healthy' ? 'Saludable' :
               healthStatus.status === 'warning' ? 'Advertencia' : 'Crítico'}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Métricas de Suscripciones */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suscripciones Activas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.subscriptions.active || 0}</div>
            <p className="text-xs text-muted-foreground">
              De {metrics?.subscriptions.total || 0} totales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos Pendientes</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.subscriptions.past_due || 0}</div>
            <p className="text-xs text-muted-foreground">
              Requieren atención
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Éxito (30d)</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.payment_stats_30d.success_rate || 0}%</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.payment_stats_30d.successful || 0} de {metrics?.payment_stats_30d.total_attempts || 0} intentos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Renovaciones Próximas</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.expiring_soon || 0}</div>
            <p className="text-xs text-muted-foreground">
              Próximos 7 días
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Estado del Cron Job */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Sincronización Automática
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Cron Job Diario</p>
              <Badge variant="default">Activo</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Se ejecuta diariamente a las 2:00 AM para sincronizar suscripciones con Stripe
            </p>
            <p className="text-xs text-muted-foreground">
              Verifica estados de suscripción, detecta expiraciones y pausa propiedades automáticamente
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Cambios de Suscripción (7 días) */}
      <Card>
        <CardHeader>
          <CardTitle>Actividad de Suscripciones (Últimos 7 días)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Total Cambios</p>
              <p className="text-2xl font-bold">{metrics?.subscription_changes_7d.total || 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Upgrades
              </p>
              <p className="text-2xl font-bold text-green-500">
                {metrics?.subscription_changes_7d.upgrades || 0}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <TrendingDown className="h-4 w-4 text-orange-500" />
                Downgrades
              </p>
              <p className="text-2xl font-bold text-orange-500">
                {metrics?.subscription_changes_7d.downgrades || 0}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <XCircle className="h-4 w-4 text-red-500" />
                Cancelaciones
              </p>
              <p className="text-2xl font-bold text-red-500">
                {metrics?.subscription_changes_7d.cancellations || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pagos Fallidos Recientes */}
      {metrics?.recent_failed_payments && metrics.recent_failed_payments.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Pagos Fallidos Recientes (Últimos 30 días)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.recent_failed_payments.slice(0, 10).map((payment) => (
                <div key={payment.id} className="flex items-center justify-between border-b pb-2">
                  <div>
                    <p className="font-medium">{payment.user_name}</p>
                    <p className="text-sm text-muted-foreground">{payment.user_email}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      ${payment.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} {payment.currency}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(payment.created_at).toLocaleDateString('es-MX')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
