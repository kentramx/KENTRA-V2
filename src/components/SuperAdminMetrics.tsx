import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, DollarSign, Home, TrendingUp, Calendar, Activity } from "lucide-react";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";

interface KPIData {
  totalUsers: number;
  monthlyRevenue: number;
  activeProperties: number;
  conversionRate: number;
  newUsersThisMonth: number;
  totalRevenue: number;
}

interface MonthlyData {
  month: string;
  users: number;
  revenue: number;
  properties: number;
}

interface SubscriptionDistribution {
  name: string;
  value: number;
  revenue: number;
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export const SuperAdminMetrics = () => {
  const [loading, setLoading] = useState(true);
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyData[]>([]);
  const [subscriptionDist, setSubscriptionDist] = useState<SubscriptionDistribution[]>([]);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      setLoading(true);

      // Total users
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // New users this month
      const startOfThisMonth = startOfMonth(new Date());
      const { count: newUsersThisMonth } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfThisMonth.toISOString());

      // Monthly revenue (current month)
      const endOfThisMonth = endOfMonth(new Date());
      const { data: monthlyPayments } = await supabase
        .from('payment_history')
        .select('amount')
        .eq('status', 'succeeded')
        .gte('created_at', startOfThisMonth.toISOString())
        .lte('created_at', endOfThisMonth.toISOString());

      const monthlyRevenue = monthlyPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      // Total revenue (all time)
      const { data: allPayments } = await supabase
        .from('payment_history')
        .select('amount')
        .eq('status', 'succeeded');

      const totalRevenue = allPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      // Active properties
      const { count: activeProperties } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'activa');

      // Conversion rate: users with subscriptions / total agents
      const { count: totalAgents } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .in('role', ['agent', 'agency']);

      const { count: subscribedUsers } = await supabase
        .from('user_subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      const conversionRate = totalAgents && totalAgents > 0 
        ? (subscribedUsers || 0) / totalAgents * 100 
        : 0;

      setKpiData({
        totalUsers: totalUsers || 0,
        monthlyRevenue,
        activeProperties: activeProperties || 0,
        conversionRate,
        newUsersThisMonth: newUsersThisMonth || 0,
        totalRevenue,
      });

      // Monthly trends (last 6 months)
      const trends = await Promise.all(
        Array.from({ length: 6 }, (_, i) => {
          const monthDate = subMonths(new Date(), 5 - i);
          const start = startOfMonth(monthDate);
          const end = endOfMonth(monthDate);
          return fetchMonthData(start, end);
        })
      );

      setMonthlyTrends(trends);

      // Subscription distribution
      const { data: subscriptions } = await supabase
        .from('user_subscriptions')
        .select(`
          plan_id,
          subscription_plans (
            display_name,
            price_monthly
          )
        `)
        .eq('status', 'active');

      const distMap = new Map<string, { count: number; revenue: number }>();
      
      subscriptions?.forEach(sub => {
        const planName = (sub.subscription_plans as any)?.display_name || 'Desconocido';
        const price = Number((sub.subscription_plans as any)?.price_monthly || 0);
        const existing = distMap.get(planName) || { count: 0, revenue: 0 };
        distMap.set(planName, {
          count: existing.count + 1,
          revenue: existing.revenue + price,
        });
      });

      const distribution: SubscriptionDistribution[] = Array.from(distMap.entries()).map(([name, data]) => ({
        name,
        value: data.count,
        revenue: data.revenue,
      }));

      setSubscriptionDist(distribution);

    } catch (error) {
      console.error('Error fetching super admin metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthData = async (start: Date, end: Date): Promise<MonthlyData> => {
    const monthLabel = format(start, 'MMM', { locale: es });

    const { count: users } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    const { data: payments } = await supabase
      .from('payment_history')
      .select('amount')
      .eq('status', 'succeeded')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    const revenue = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    const { count: properties } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    return {
      month: monthLabel,
      users: users || 0,
      revenue,
      properties: properties || 0,
    };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!kpiData) return null;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Totales</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpiData.totalUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              +{kpiData.newUsersThisMonth} este mes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue Mensual</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${kpiData.monthlyRevenue.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground">
              Total: ${kpiData.totalRevenue.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Propiedades Activas</CardTitle>
            <Home className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpiData.activeProperties.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              En la plataforma
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Conversión</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpiData.conversionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Agentes con suscripción activa
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nuevos Usuarios</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpiData.newUsersThisMonth}</div>
            <p className="text-xs text-muted-foreground">
              Este mes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue Promedio</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(kpiData.totalRevenue / Math.max(kpiData.totalUsers, 1)).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground">
              Por usuario
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Tendencia de Revenue</CardTitle>
            <CardDescription>Últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlyTrends}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="month" 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [`$${value.toLocaleString('es-MX')}`, 'Revenue']}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="hsl(var(--chart-1))" 
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* User Growth */}
        <Card>
          <CardHeader>
            <CardTitle>Crecimiento de Usuarios</CardTitle>
            <CardDescription>Últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="month" 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="users" 
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--chart-2))', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Properties Growth */}
        <Card>
          <CardHeader>
            <CardTitle>Nuevas Propiedades por Mes</CardTitle>
            <CardDescription>Últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="month" 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar 
                  dataKey="properties" 
                  fill="hsl(var(--chart-3))"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Subscription Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución de Suscripciones</CardTitle>
            <CardDescription>Planes activos actuales</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={subscriptionDist}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="hsl(var(--chart-1))"
                  dataKey="value"
                >
                  {subscriptionDist.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number, name: string, props: any) => [
                    `${value} suscripciones`,
                    `$${props.payload.revenue.toLocaleString('es-MX')} MRR`
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {subscriptionDist.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-medium">{item.value}</span>
                    <span className="text-muted-foreground">
                      ${item.revenue.toLocaleString('es-MX')}/mes
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
