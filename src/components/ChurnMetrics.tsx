import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { TrendingDown, TrendingUp, Users, DollarSign, Target, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useMonitoring } from "@/lib/monitoring";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface ChurnMetrics {
  churn_rate_monthly: Array<{
    month: string;
    cancellations: number;
    active_at_start: number;
    churn_rate: number;
  }>;
  retention_rate_monthly: Array<{
    month: string;
    renewed_users: number;
    eligible_for_renewal: number;
    retention_rate: number;
  }>;
  cohort_analysis: Array<{
    cohort_month: string;
    total_users: number;
    active_now: number;
    retention_percentage: number;
  }>;
  ltv_analysis: Array<{
    plan_name: string;
    total_customers: number;
    avg_ltv: number;
    total_revenue: number;
  }>;
  cancellation_reasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
  summary: {
    total_active_subscriptions: number;
    total_canceled_all_time: number;
    total_cancellations_period: number;
    overall_churn_rate: number;
    avg_customer_lifetime_months: number;
    avg_revenue_per_customer: number;
  };
}

const COLORS = ['#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899'];

export const ChurnMetrics = () => {
  const { error: logError, captureException } = useMonitoring();
  const [metrics, setMetrics] = useState<ChurnMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'3m' | '6m' | '1y'>('6m');

  useEffect(() => {
    fetchChurnMetrics();
  }, [dateRange]);

  const fetchChurnMetrics = async () => {
    try {
      const startDate = new Date();
      if (dateRange === '3m') startDate.setMonth(startDate.getMonth() - 3);
      else if (dateRange === '6m') startDate.setMonth(startDate.getMonth() - 6);
      else startDate.setFullYear(startDate.getFullYear() - 1);

      const { data, error } = await supabase.rpc('get_churn_metrics', {
        start_date: startDate.toISOString(),
        end_date: new Date().toISOString()
      });

      if (error) throw error;
      setMetrics(data as unknown as ChurnMetrics);
    } catch (error) {
      logError('Error fetching churn metrics', {
        component: 'ChurnMetrics',
        dateRange,
        error,
      });
      captureException(error as Error, {
        component: 'ChurnMetrics',
        action: 'fetchChurnMetrics',
        dateRange,
      });
      toast.error('Error al cargar métricas de churn');
    } finally {
      setLoading(false);
    }
  };

  const formatChurnData = () => {
    if (!metrics?.churn_rate_monthly) return [];
    return metrics.churn_rate_monthly.map(item => ({
      mes: new Date(item.month).toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }),
      churn: Number(item.churn_rate) || 0,
      cancelaciones: item.cancellations
    })).reverse();
  };

  const formatRetentionData = () => {
    if (!metrics?.retention_rate_monthly) return [];
    return metrics.retention_rate_monthly.map(item => ({
      mes: new Date(item.month).toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }),
      retention: Number(item.retention_rate) || 0,
      renovaciones: item.renewed_users
    })).reverse();
  };

  const formatLTVData = () => {
    if (!metrics?.ltv_analysis) return [];
    return metrics.ltv_analysis
      .filter(item => item.avg_ltv > 0)
      .map(item => ({
        plan: item.plan_name,
        ltv: Number(item.avg_ltv) || 0,
        clientes: item.total_customers
      }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {metrics?.summary.overall_churn_rate?.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.summary.total_cancellations_period || 0} cancelaciones
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Retention Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {(100 - (metrics?.summary.overall_churn_rate || 0)).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Usuarios que permanecen
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">LTV Promedio</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${metrics?.summary.avg_revenue_per_customer?.toFixed(0) || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              MXN por cliente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lifetime</CardTitle>
            <Target className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.summary.avg_customer_lifetime_months?.toFixed(1) || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              meses promedio
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activas</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.summary.total_active_subscriptions || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              suscripciones
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Churn Rate Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Tendencia de Churn Rate</CardTitle>
            <CardDescription>Porcentaje de cancelaciones mensual</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={formatChurnData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="churn" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  name="Churn Rate %"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Retention Rate Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Tendencia de Retention Rate</CardTitle>
            <CardDescription>Porcentaje de renovaciones mensual</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={formatRetentionData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="retention" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  name="Retention Rate %"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* LTV by Plan */}
        <Card>
          <CardHeader>
            <CardTitle>LTV Promedio por Plan</CardTitle>
            <CardDescription>Valor de vida del cliente por plan</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={formatLTVData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="plan" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="ltv" fill="#8b5cf6" name="LTV Promedio (MXN)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cancellation Reasons */}
        <Card>
          <CardHeader>
            <CardTitle>Razones de Cancelación</CardTitle>
            <CardDescription>Top motivos de cancelación</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics?.cancellation_reasons && metrics.cancellation_reasons.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={metrics.cancellation_reasons}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.reason}: ${entry.percentage}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                    nameKey="reason"
                  >
                    {metrics.cancellation_reasons.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px]">
                <p className="text-muted-foreground">No hay datos de cancelaciones</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cohort Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Análisis de Cohortes</CardTitle>
          <CardDescription>Retención por mes de registro</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metrics?.cohort_analysis && metrics.cohort_analysis.length > 0 ? (
              metrics.cohort_analysis.map((cohort) => (
                <div key={cohort.cohort_month} className="flex items-center justify-between border-b pb-2">
                  <div>
                    <p className="font-medium">
                      {new Date(cohort.cohort_month).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {cohort.total_users} usuarios registrados
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-500">
                      {cohort.retention_percentage}%
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {cohort.active_now} activos ahora
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground">No hay datos de cohortes</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
