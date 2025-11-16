import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ArrowUpIcon, ArrowDownIcon, TrendingUp, DollarSign, CreditCard, Users, Calendar, Download, Search } from 'lucide-react';
import { format, subDays, subWeeks, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useMonitoring } from '@/lib/monitoring';

interface DailyRevenue {
  date: string;
  revenue: number;
  transactions: number;
}

interface WeeklyRevenue {
  week_start: string;
  revenue: number;
  transactions: number;
}

interface MonthlyRevenue {
  month_start: string;
  revenue: number;
  transactions: number;
}

interface RevenueByPlan {
  plan_name: string;
  revenue: number;
  transactions: number;
}

interface TopAgent {
  user_id: string;
  agent_name: string;
  plan_name: string | null;
  total_revenue: number;
  total_transactions: number;
}

interface Summary {
  total_revenue: number;
  total_transactions: number;
  success_rate: number;
  avg_transaction: number;
  mrr: number;
  arr: number;
  active_subscriptions: number;
}

interface FinancialMetrics {
  daily_revenue: DailyRevenue[] | null;
  weekly_revenue: WeeklyRevenue[] | null;
  monthly_revenue: MonthlyRevenue[] | null;
  revenue_by_plan: RevenueByPlan[] | null;
  top_agents: TopAgent[] | null;
  summary: Summary;
}

interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  payment_type: string;
  created_at: string;
  metadata: any;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const PERIOD_OPTIONS = [
  { value: '7d', label: 'Últimos 7 días' },
  { value: '30d', label: 'Últimos 30 días' },
  { value: '3m', label: 'Últimos 3 meses' },
  { value: '6m', label: 'Últimos 6 meses' },
  { value: '1y', label: 'Último año' },
];

export function FinancialDashboard() {
  const { toast } = useToast();
  const { error: logError, captureException } = useMonitoring();
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchFinancialData();
    fetchRecentTransactions();
  }, [period]);

  const getDateRange = () => {
    const end = new Date();
    let start = new Date();

    switch (period) {
      case '7d':
        start = subDays(end, 7);
        break;
      case '30d':
        start = subDays(end, 30);
        break;
      case '3m':
        start = subMonths(end, 3);
        break;
      case '6m':
        start = subMonths(end, 6);
        break;
      case '1y':
        start = subMonths(end, 12);
        break;
    }

    return { start, end };
  };

  const fetchFinancialData = async () => {
    try {
      setLoading(true);
      const { start, end } = getDateRange();

      const { data, error } = await supabase.rpc('get_financial_metrics', {
        start_date: start.toISOString(),
        end_date: end.toISOString(),
      });

      if (error) throw error;

      // Parse JSON if needed
      const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
      setMetrics(parsedData as FinancialMetrics);
    } catch (error: any) {
      logError('Error fetching financial data', {
        component: 'FinancialDashboard',
        period,
        error,
      });
      captureException(error, {
        component: 'FinancialDashboard',
        action: 'fetchFinancialData',
      });
      toast({
        title: 'Error',
        description: error.message || 'Error al cargar métricas financieras',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setTransactions(data || []);
    } catch (error: any) {
      logError('Error fetching transactions', {
        component: 'FinancialDashboard',
        error,
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const getComparisonData = (currentValue: number, previousValue: number) => {
    if (previousValue === 0) return { percentage: 0, isPositive: true };
    const percentage = ((currentValue - previousValue) / previousValue) * 100;
    return { percentage: Math.abs(percentage), isPositive: percentage >= 0 };
  };

  const filteredTransactions = transactions.filter((tx) => {
    const matchesStatus = statusFilter === 'all' || tx.status === statusFilter;
    const matchesSearch = searchTerm === '' || 
      tx.user_id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const exportToCSV = () => {
    if (!metrics) return;

    const csvContent = [
      ['Métrica', 'Valor'],
      ['Ingresos Totales', formatCurrency(metrics.summary.total_revenue)],
      ['Transacciones Totales', metrics.summary.total_transactions],
      ['Tasa de Éxito', `${metrics.summary.success_rate}%`],
      ['MRR', formatCurrency(metrics.summary.mrr)],
      ['ARR', formatCurrency(metrics.summary.arr)],
      ['Suscripciones Activas', metrics.summary.active_subscriptions],
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-financiero-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <Alert>
        <AlertDescription>No se pudieron cargar las métricas financieras</AlertDescription>
      </Alert>
    );
  }

  const todayRevenue = metrics.daily_revenue?.[0]?.revenue || 0;
  const yesterdayRevenue = metrics.daily_revenue?.[1]?.revenue || 0;
  const dailyComparison = getComparisonData(todayRevenue, yesterdayRevenue);

  return (
    <div className="space-y-6">
      {/* Header con filtros */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold">Panel Financiero</h2>
          <p className="text-muted-foreground">Análisis completo de ingresos y transacciones</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={exportToCSV} variant="outline" size="icon">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Alertas */}
      {dailyComparison.isPositive && dailyComparison.percentage > 20 && (
        <Alert className="bg-green-50 border-green-200">
          <TrendingUp className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            ¡Excelente! Los ingresos de hoy superan en {dailyComparison.percentage.toFixed(1)}% a ayer
          </AlertDescription>
        </Alert>
      )}

      {!dailyComparison.isPositive && dailyComparison.percentage > 20 && (
        <Alert className="bg-red-50 border-red-200">
          <AlertDescription className="text-red-800">
            ⚠️ Caída del {dailyComparison.percentage.toFixed(1)}% en ingresos diarios
          </AlertDescription>
        </Alert>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Hoy</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(todayRevenue)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {dailyComparison.isPositive ? (
                <ArrowUpIcon className="mr-1 h-4 w-4 text-green-500" />
              ) : (
                <ArrowDownIcon className="mr-1 h-4 w-4 text-red-500" />
              )}
              <span className={dailyComparison.isPositive ? 'text-green-500' : 'text-red-500'}>
                {dailyComparison.percentage.toFixed(1)}%
              </span>
              <span className="ml-1">vs ayer</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.summary.mrr)}</div>
            <p className="text-xs text-muted-foreground">Ingresos recurrentes mensuales</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ARR</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.summary.arr)}</div>
            <p className="text-xs text-muted-foreground">Ingresos recurrentes anuales</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ingresos</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.summary.total_revenue)}</div>
            <p className="text-xs text-muted-foreground">{period} seleccionado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transacciones</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.summary.total_transactions}</div>
            <p className="text-xs text-muted-foreground">
              Tasa de éxito: {metrics.summary.success_rate.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suscripciones Activas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.summary.active_subscriptions}</div>
            <p className="text-xs text-muted-foreground">
              Promedio: {formatCurrency(metrics.summary.avg_transaction)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Ingresos Diarios */}
        <Card>
          <CardHeader>
            <CardTitle>Ingresos Diarios</CardTitle>
            <CardDescription>Últimos {period === '7d' ? '7' : period === '30d' ? '30' : '90'} días</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics.daily_revenue?.slice(0, period === '7d' ? 7 : period === '30d' ? 30 : 90).reverse() || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(date) => format(new Date(date), 'dd/MM', { locale: es })} />
                <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Ingresos" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Ingresos Mensuales */}
        <Card>
          <CardHeader>
            <CardTitle>Ingresos Mensuales</CardTitle>
            <CardDescription>Últimos 12 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={metrics.monthly_revenue?.reverse() || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month_start" tickFormatter={(date) => format(new Date(date), 'MMM', { locale: es })} />
                <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} name="Ingresos" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribución por Plan */}
        <Card>
          <CardHeader>
            <CardTitle>Ingresos por Tipo de Plan</CardTitle>
            <CardDescription>Distribución de revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={metrics.revenue_by_plan || []}
                  dataKey="revenue"
                  nameKey="plan_name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.plan_name}: ${formatCurrency(entry.revenue)}`}
                >
                  {metrics.revenue_by_plan?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top 10 Agentes */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Agentes por Revenue</CardTitle>
            <CardDescription>Clientes con mayores ingresos</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={metrics.top_agents || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                <YAxis dataKey="agent_name" type="category" width={100} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="total_revenue" fill="#8b5cf6" name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Transacciones Recientes */}
      <Card>
        <CardHeader>
          <CardTitle>Transacciones Recientes</CardTitle>
          <CardDescription>Últimas 50 transacciones del sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por User ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="succeeded">Exitosos</SelectItem>
                <SelectItem value="failed">Fallidos</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No hay transacciones para mostrar
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono text-sm">
                        {format(new Date(tx.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{tx.user_id.slice(0, 8)}...</TableCell>
                      <TableCell>{tx.payment_type}</TableCell>
                      <TableCell className="font-semibold">{formatCurrency(tx.amount)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            tx.status === 'succeeded'
                              ? 'default'
                              : tx.status === 'failed'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {tx.status === 'succeeded' ? 'Exitoso' : tx.status === 'failed' ? 'Fallido' : 'Pendiente'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
