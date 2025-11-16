import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Loader2, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useMonitoring } from '@/lib/monitoring';

const COLORS = {
  approved: 'hsl(var(--chart-1))',
  rejected: 'hsl(var(--chart-2))',
  resubmitted: 'hsl(var(--chart-3))',
  auto_approved: 'hsl(var(--chart-4))',
};

const REJECTION_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const AdminModerationMetrics = () => {
  const { error: logError, captureException } = useMonitoring();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7'); // days
  const [metrics, setMetrics] = useState({
    totalReviewed: 0,
    approvalRate: 0,
    avgReviewTime: 0,
    resubmissionRate: 0,
  });
  const [trendData, setTrendData] = useState<any[]>([]);
  const [reviewTimeData, setReviewTimeData] = useState<any[]>([]);
  const [rejectionReasons, setRejectionReasons] = useState<any[]>([]);
  const [adminStats, setAdminStats] = useState<any[]>([]);

  useEffect(() => {
    fetchMetrics();
  }, [dateRange]);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const daysAgo = parseInt(dateRange);
      const startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

      // Fetch moderation history
      const { data: history, error } = await (supabase as any)
        .from('property_moderation_history')
        .select('*')
        .gte('created_at', startDate)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Calculate main metrics
      const totalReviewed = history?.filter((h: any) => 
        h.action === 'approved' || h.action === 'rejected' || h.action === 'auto_approved'
      ).length || 0;

      const approved = history?.filter((h: any) => 
        h.action === 'approved' || h.action === 'auto_approved'
      ).length || 0;

      const approvalRate = totalReviewed > 0 ? (approved / totalReviewed) * 100 : 0;

      const resubmissions = history?.filter((h: any) => h.action === 'resubmitted').length || 0;
      const resubmissionRate = totalReviewed > 0 ? (resubmissions / totalReviewed) * 100 : 0;

      // Calculate average review time
      const { data: avgTimeData } = await (supabase as any).rpc('get_avg_review_time_minutes');
      const avgReviewTime = avgTimeData || 0;

      setMetrics({
        totalReviewed,
        approvalRate: Math.round(approvalRate),
        avgReviewTime: Math.round(avgReviewTime),
        resubmissionRate: Math.round(resubmissionRate),
      });

      // Process trend data (by day)
      const trendMap = new Map();
      history?.forEach((h: any) => {
        const date = new Date(h.created_at).toLocaleDateString('es-MX', { 
          month: 'short', 
          day: 'numeric' 
        });
        
        if (!trendMap.has(date)) {
          trendMap.set(date, {
            date,
            aprobadas: 0,
            rechazadas: 0,
            reenviadas: 0,
            auto_aprobadas: 0,
          });
        }

        const entry = trendMap.get(date);
        if (h.action === 'approved') entry.aprobadas++;
        else if (h.action === 'rejected') entry.rechazadas++;
        else if (h.action === 'resubmitted') entry.reenviadas++;
        else if (h.action === 'auto_approved') entry.auto_aprobadas++;
      });

      setTrendData(Array.from(trendMap.values()));

      // Process review time by day
      const reviewTimeMap = new Map();
      for (const h of history || []) {
        if (h.action !== 'approved' && h.action !== 'rejected' && h.action !== 'auto_approved') continue;

        const { data: property } = await supabase
          .from('properties')
          .select('created_at')
          .eq('id', h.property_id)
          .single();

        if (property) {
          const reviewTime = (new Date(h.created_at).getTime() - new Date(property.created_at).getTime()) / (1000 * 60 * 60); // hours
          const date = new Date(h.created_at).toLocaleDateString('es-MX', { 
            month: 'short', 
            day: 'numeric' 
          });

          if (!reviewTimeMap.has(date)) {
            reviewTimeMap.set(date, { date, times: [] });
          }
          reviewTimeMap.get(date).times.push(reviewTime);
        }
      }

      const reviewTimeArray = Array.from(reviewTimeMap.values()).map(entry => ({
        date: entry.date,
        tiempo: Math.round(entry.times.reduce((a: number, b: number) => a + b, 0) / entry.times.length),
      }));

      setReviewTimeData(reviewTimeArray);

      // Process rejection reasons
      const rejectionMap = new Map();
      history?.filter((h: any) => h.action === 'rejected' && h.rejection_reason?.code)
        .forEach((h: any) => {
          const code = h.rejection_reason.code;
          const label = h.rejection_reason.label;
          if (!rejectionMap.has(code)) {
            rejectionMap.set(code, { name: label, value: 0 });
          }
          rejectionMap.get(code).value++;
        });

      setRejectionReasons(Array.from(rejectionMap.values()));

      // Admin performance stats
      const adminMap = new Map();
      history?.filter((h: any) => h.action === 'approved' || h.action === 'rejected')
        .forEach((h: any) => {
          if (!adminMap.has(h.admin_id)) {
            adminMap.set(h.admin_id, {
              id: h.admin_id,
              approved: 0,
              rejected: 0,
              total: 0,
            });
          }
          const entry = adminMap.get(h.admin_id);
          entry.total++;
          if (h.action === 'approved') entry.approved++;
          else entry.rejected++;
        });

      setAdminStats(Array.from(adminMap.values()));

    } catch (error) {
      logError('Error fetching moderation metrics', {
        component: 'AdminModerationMetrics',
        dateRange,
        error,
      });
      captureException(error as Error, {
        component: 'AdminModerationMetrics',
        action: 'fetchMetrics',
        dateRange,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Métricas de Moderación</h2>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 días</SelectItem>
            <SelectItem value="14">Últimos 14 días</SelectItem>
            <SelectItem value="30">Últimos 30 días</SelectItem>
            <SelectItem value="90">Últimos 90 días</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revisadas</p>
                <p className="text-3xl font-bold">{metrics.totalReviewed}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-primary opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tasa de Aprobación</p>
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-bold">{metrics.approvalRate}%</p>
                  {metrics.approvalRate >= 70 ? (
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  )}
                </div>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tiempo Promedio</p>
                <p className="text-3xl font-bold">{metrics.avgReviewTime}h</p>
              </div>
              <Clock className="h-8 w-8 text-blue-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tasa de Reenvío</p>
                <p className="text-3xl font-bold">{metrics.resubmissionRate}%</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-600 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Tendencia de Revisiones</CardTitle>
        </CardHeader>
        <CardContent>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--foreground))" />
                <YAxis stroke="hsl(var(--foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="aprobadas" 
                  stroke={COLORS.approved} 
                  strokeWidth={2}
                  name="Aprobadas"
                />
                <Line 
                  type="monotone" 
                  dataKey="rechazadas" 
                  stroke={COLORS.rejected} 
                  strokeWidth={2}
                  name="Rechazadas"
                />
                <Line 
                  type="monotone" 
                  dataKey="reenviadas" 
                  stroke={COLORS.resubmitted} 
                  strokeWidth={2}
                  name="Reenviadas"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No hay datos suficientes para mostrar tendencias
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Review Time Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Tiempo de Revisión por Día</CardTitle>
          </CardHeader>
          <CardContent>
            {reviewTimeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={reviewTimeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--foreground))" />
                  <YAxis stroke="hsl(var(--foreground))" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar 
                    dataKey="tiempo" 
                    fill={COLORS.approved}
                    name="Horas promedio"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No hay datos suficientes
              </p>
            )}
          </CardContent>
        </Card>

        {/* Rejection Reasons Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Motivos de Rechazo</CardTitle>
          </CardHeader>
          <CardContent>
            {rejectionReasons.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={rejectionReasons}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name} (${entry.value})`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {rejectionReasons.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={REJECTION_COLORS[index % REJECTION_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No hay rechazos en este período
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Admin Performance */}
      {adminStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Desempeño por Administrador</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {adminStats.map((admin, index) => (
                <div key={admin.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="font-semibold text-primary">#{index + 1}</span>
                    </div>
                    <div>
                      <p className="font-medium">Admin {admin.id.substring(0, 8)}</p>
                      <p className="text-sm text-muted-foreground">
                        {admin.total} revisiones totales
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-6 text-sm">
                    <div className="text-center">
                      <p className="font-semibold text-green-600">{admin.approved}</p>
                      <p className="text-muted-foreground">Aprobadas</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-red-600">{admin.rejected}</p>
                      <p className="text-muted-foreground">Rechazadas</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-primary">
                        {Math.round((admin.approved / admin.total) * 100)}%
                      </p>
                      <p className="text-muted-foreground">Tasa Aprobación</p>
                    </div>
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

export default AdminModerationMetrics;
