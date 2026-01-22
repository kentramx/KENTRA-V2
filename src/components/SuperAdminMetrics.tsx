import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, DollarSign, Home, TrendingUp, TrendingDown, Calendar, Activity } from "lucide-react";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format, subMonths, startOfMonth, endOfMonth, subYears } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface KPIData {
  totalUsers: number;
  monthlyRevenue: number;
  activeProperties: number;
  conversionRate: number;
  newUsersThisMonth: number;
  totalRevenue: number;
  // Previous period comparisons
  lastMonthUsers: number;
  lastYearUsers: number;
  lastMonthRevenue: number;
  lastMonthProperties: number;
  lastMonthConversion: number;
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

      const now = new Date();
      const startOfThisMonth = startOfMonth(now);
      const endOfThisMonth = endOfMonth(now);

      // Previous periods
      const startOfLastMonth = startOfMonth(subMonths(now, 1));
      const endOfLastMonth = endOfMonth(subMonths(now, 1));
      const startOfLastYear = startOfMonth(subYears(now, 1));
      const endOfLastYear = endOfMonth(subYears(now, 1));

      // SCALABILITY: Batch all independent queries in parallel instead of sequential
      const [
        // User counts
        totalUsersResult,
        newUsersThisMonthResult,
        lastMonthUsersResult,
        lastYearUsersResult,
        // Revenue data
        monthlyPaymentsResult,
        lastMonthPaymentsResult,
        allPaymentsResult,
        // Property counts
        activePropertiesResult,
        lastMonthPropertiesResult,
        // Conversion rate data
        totalAgentsResult,
        subscribedUsersResult,
        totalAgentsLastMonthResult,
        subscribedUsersLastMonthResult,
        // Subscriptions distribution
        subscriptionsResult,
      ] = await Promise.all([
        // User counts
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true })
          .gte('created_at', startOfThisMonth.toISOString())
          .lte('created_at', endOfThisMonth.toISOString()),
        supabase.from('profiles').select('*', { count: 'exact', head: true })
          .gte('created_at', startOfLastMonth.toISOString())
          .lte('created_at', endOfLastMonth.toISOString()),
        supabase.from('profiles').select('*', { count: 'exact', head: true })
          .gte('created_at', startOfLastYear.toISOString())
          .lte('created_at', endOfLastYear.toISOString()),
        // Revenue data - use SUM aggregation via RPC or select amounts
        supabase.from('payment_history').select('amount')
          .eq('status', 'succeeded')
          .gte('created_at', startOfThisMonth.toISOString())
          .lte('created_at', endOfThisMonth.toISOString()),
        supabase.from('payment_history').select('amount')
          .eq('status', 'succeeded')
          .gte('created_at', startOfLastMonth.toISOString())
          .lte('created_at', endOfLastMonth.toISOString()),
        supabase.from('payment_history').select('amount')
          .eq('status', 'succeeded'),
        // Property counts
        supabase.from('properties').select('*', { count: 'exact', head: true })
          .eq('status', 'activa'),
        supabase.from('properties').select('*', { count: 'exact', head: true })
          .eq('status', 'activa')
          .lte('created_at', endOfLastMonth.toISOString()),
        // Conversion rate data
        supabase.from('user_roles').select('*', { count: 'exact', head: true })
          .in('role', ['agent', 'agency']),
        supabase.from('user_subscriptions').select('*', { count: 'exact', head: true })
          .eq('status', 'active'),
        supabase.from('user_roles').select('*', { count: 'exact', head: true })
          .in('role', ['agent', 'agency'])
          .lte('created_at', endOfLastMonth.toISOString()),
        supabase.from('user_subscriptions').select('*', { count: 'exact', head: true })
          .eq('status', 'active')
          .lte('created_at', endOfLastMonth.toISOString()),
        // Subscription distribution
        supabase.from('user_subscriptions').select(`
          plan_id,
          subscription_plans (
            display_name,
            price_monthly
          )
        `).eq('status', 'active'),
      ]);

      // Extract counts
      const totalUsers = totalUsersResult.count || 0;
      const newUsersThisMonth = newUsersThisMonthResult.count || 0;
      const lastMonthUsers = lastMonthUsersResult.count || 0;
      const lastYearUsers = lastYearUsersResult.count || 0;
      const activeProperties = activePropertiesResult.count || 0;
      const lastMonthProperties = lastMonthPropertiesResult.count || 0;
      const totalAgents = totalAgentsResult.count || 0;
      const subscribedUsers = subscribedUsersResult.count || 0;
      const totalAgentsLastMonth = totalAgentsLastMonthResult.count || 0;
      const subscribedUsersLastMonth = subscribedUsersLastMonthResult.count || 0;

      // Calculate revenues
      const monthlyRevenue = monthlyPaymentsResult.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const lastMonthRevenue = lastMonthPaymentsResult.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const totalRevenue = allPaymentsResult.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      // Calculate conversion rates
      const conversionRate = totalAgents > 0
        ? (subscribedUsers / totalAgents * 100)
        : 0;

      const lastMonthConversion = totalAgentsLastMonth > 0
        ? (subscribedUsersLastMonth / totalAgentsLastMonth * 100)
        : 0;

      setKpiData({
        totalUsers,
        monthlyRevenue,
        activeProperties,
        conversionRate,
        newUsersThisMonth,
        totalRevenue,
        lastMonthUsers,
        lastYearUsers,
        lastMonthRevenue,
        lastMonthProperties,
        lastMonthConversion,
      });

      // SCALABILITY: Monthly trends - batch all 6 months in parallel
      const monthRanges = Array.from({ length: 6 }, (_, i) => {
        const monthDate = subMonths(new Date(), 5 - i);
        return {
          label: format(startOfMonth(monthDate), 'MMM', { locale: es }),
          start: startOfMonth(monthDate),
          end: endOfMonth(monthDate),
        };
      });

      // Fetch all monthly data in parallel (18 queries -> 6 batched calls)
      const trendsResults = await Promise.all(
        monthRanges.map(async ({ label, start, end }) => {
          const [usersRes, paymentsRes, propsRes] = await Promise.all([
            supabase.from('profiles').select('*', { count: 'exact', head: true })
              .gte('created_at', start.toISOString())
              .lte('created_at', end.toISOString()),
            supabase.from('payment_history').select('amount')
              .eq('status', 'succeeded')
              .gte('created_at', start.toISOString())
              .lte('created_at', end.toISOString()),
            supabase.from('properties').select('*', { count: 'exact', head: true })
              .gte('created_at', start.toISOString())
              .lte('created_at', end.toISOString()),
          ]);

          return {
            month: label,
            users: usersRes.count || 0,
            revenue: paymentsRes.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0,
            properties: propsRes.count || 0,
          };
        })
      );

      setMonthlyTrends(trendsResults);

      // Process subscription distribution (already fetched above)
      const distMap = new Map<string, { count: number; revenue: number }>();

      subscriptionsResult.data?.forEach(sub => {
        const plans = sub.subscription_plans as { display_name?: string; price_monthly?: number } | null;
        const planName = plans?.display_name || 'Desconocido';
        const price = Number(plans?.price_monthly || 0);
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

  // Calculate growth percentages
  const usersMoMGrowth = kpiData.lastMonthUsers > 0 
    ? ((kpiData.newUsersThisMonth - kpiData.lastMonthUsers) / kpiData.lastMonthUsers * 100)
    : 0;
  
  const usersYoYGrowth = kpiData.lastYearUsers > 0
    ? ((kpiData.newUsersThisMonth - kpiData.lastYearUsers) / kpiData.lastYearUsers * 100)
    : 0;

  const revenueMoMGrowth = kpiData.lastMonthRevenue > 0
    ? ((kpiData.monthlyRevenue - kpiData.lastMonthRevenue) / kpiData.lastMonthRevenue * 100)
    : 0;

  const propertiesMoMGrowth = kpiData.lastMonthProperties > 0
    ? ((kpiData.activeProperties - kpiData.lastMonthProperties) / kpiData.lastMonthProperties * 100)
    : 0;

  const conversionMoMGrowth = kpiData.lastMonthConversion > 0
    ? kpiData.conversionRate - kpiData.lastMonthConversion
    : 0;

  const GrowthIndicator = ({ value, showPercentage = true }: { value: number; showPercentage?: boolean }) => {
    const isPositive = value >= 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;
    const colorClass = isPositive ? 'text-green-600' : 'text-red-600';
    const bgClass = isPositive ? 'bg-green-50' : 'bg-red-50';
    
    return (
      <Badge variant="outline" className={`${bgClass} ${colorClass} border-none`}>
        <Icon className="h-3 w-3 mr-1" />
        {isPositive && '+'}{value.toFixed(1)}{showPercentage && '%'}
      </Badge>
    );
  };

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
            <div className="text-2xl font-bold mb-2">{kpiData.totalUsers.toLocaleString()}</div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground">Este mes:</span>
              <span className="text-sm font-semibold">{kpiData.newUsersThisMonth}</span>
              <GrowthIndicator value={usersMoMGrowth} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">vs año anterior:</span>
              <GrowthIndicator value={usersYoYGrowth} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue Mensual</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">
              ${kpiData.monthlyRevenue.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground">vs mes anterior:</span>
              <GrowthIndicator value={revenueMoMGrowth} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Total acumulado: ${kpiData.totalRevenue.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Propiedades Activas</CardTitle>
            <Home className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">{kpiData.activeProperties.toLocaleString()}</div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground">vs mes anterior:</span>
              <GrowthIndicator value={propertiesMoMGrowth} />
            </div>
            <p className="text-xs text-muted-foreground">
              En la plataforma actualmente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Conversión</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">{kpiData.conversionRate.toFixed(1)}%</div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground">vs mes anterior:</span>
              <GrowthIndicator value={conversionMoMGrowth} showPercentage={false} />
              <span className="text-xs">pts</span>
            </div>
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
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-1">
              ${(kpiData.totalRevenue / Math.max(kpiData.totalUsers, 1)).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground">
              Por usuario (lifetime value)
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
                  formatter={(value: number, name: string, props: { payload: { revenue: number } }) => [
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
