import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  FunnelChart,
  Funnel,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  DollarSign, 
  Target,
  Calendar,
  Filter,
  Loader2,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { useMonitoring } from "@/lib/monitoring";

interface MetricsData {
  total_events: number;
  conversions: number;
  total_value: number;
  events_by_type: Array<{ event_type: string; count: number; total_value: number }>;
  daily_trend: Array<{ date: string; total_events: number; conversions: number; total_value: number }>;
  funnel_data: {
    view_content: number;
    initiate_checkout: number;
    purchase: number;
  };
}

interface ConversionEvent {
  id: string;
  created_at: string;
  event_type: string;
  event_source: string;
  user_email: string | null;
  user_role: string | null;
  content_name: string | null;
  content_category: string | null;
  value: number | null;
  currency: string;
}

const EVENT_COLORS: Record<string, string> = {
  CompleteRegistration: "#10b981",
  Contact: "#3b82f6",
  InitiateCheckout: "#f59e0b",
  Purchase: "#8b5cf6",
  Lead: "#ec4899",
  ViewContent: "#6366f1",
};

const EVENT_LABELS: Record<string, string> = {
  CompleteRegistration: "Registro Completado",
  Contact: "Contacto",
  InitiateCheckout: "Inicio de Checkout",
  Purchase: "Compra",
  Lead: "Lead",
  ViewContent: "Vista de Contenido",
};

export const MarketingMetrics = () => {
  const { error: logError, captureException } = useMonitoring();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [recentEvents, setRecentEvents] = useState<ConversionEvent[]>([]);
  const [dateRange, setDateRange] = useState<string>("30");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [eventSourceFilter, setEventSourceFilter] = useState<string>("all");

  useEffect(() => {
    fetchMetrics();
    fetchRecentEvents();
  }, [dateRange]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const endDate = new Date();
      const startDate = subDays(endDate, parseInt(dateRange));

      const { data, error } = await supabase.rpc("get_marketing_metrics", {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      });

      if (error) {
        logError("Error fetching marketing metrics", {
          component: "MarketingMetrics",
          dateRange,
          error,
        });
        throw error;
      }

      // Validar y normalizar datos
      const rawData = data as any;
      const normalizedData: MetricsData = {
        total_events: rawData?.total_events || 0,
        conversions: rawData?.conversions || 0,
        total_value: rawData?.total_value || 0,
        events_by_type: rawData?.events_by_type || [],
        daily_trend: rawData?.daily_trend || [],
        funnel_data: rawData?.funnel_data || {
          view_content: 0,
          initiate_checkout: 0,
          purchase: 0,
        },
      };

      setMetrics(normalizedData);
    } catch (error: any) {
      captureException(error, {
        component: "MarketingMetrics",
        action: "fetchMetrics",
        dateRange,
      });
      toast({
        title: "Error",
        description: "No se pudieron cargar las métricas de marketing",
        variant: "destructive",
      });
      // Establecer métricas vacías en caso de error
      setMetrics({
        total_events: 0,
        conversions: 0,
        total_value: 0,
        events_by_type: [],
        daily_trend: [],
        funnel_data: {
          view_content: 0,
          initiate_checkout: 0,
          purchase: 0,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentEvents = async () => {
    try {
      let query = supabase
        .from("conversion_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (eventTypeFilter !== "all") {
        query = query.eq("event_type", eventTypeFilter);
      }

      if (eventSourceFilter !== "all") {
        query = query.eq("event_source", eventSourceFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setRecentEvents(data || []);
    } catch (error: any) {
      logError("Error fetching recent events", {
        component: "MarketingMetrics",
        eventTypeFilter,
        eventSourceFilter,
        error,
      });
    }
  };

  useEffect(() => {
    fetchRecentEvents();
  }, [eventTypeFilter, eventSourceFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No hay datos disponibles</p>
        </CardContent>
      </Card>
    );
  }

  const conversionRate = metrics.total_events > 0 
    ? ((metrics.conversions / metrics.total_events) * 100).toFixed(2)
    : "0.00";

  const funnelData = [
    { name: "Vista de Contenido", value: metrics.funnel_data.view_content, fill: EVENT_COLORS.ViewContent },
    { name: "Inicio de Checkout", value: metrics.funnel_data.initiate_checkout, fill: EVENT_COLORS.InitiateCheckout },
    { name: "Compra", value: metrics.funnel_data.purchase, fill: EVENT_COLORS.Purchase },
  ].filter(item => item.value > 0);

  return (
    <div className="space-y-6">
      {/* Filtros de fecha */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Seleccionar período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 días</SelectItem>
              <SelectItem value="30">Últimos 30 días</SelectItem>
              <SelectItem value="90">Últimos 90 días</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={fetchMetrics}>
          Actualizar
        </Button>
      </div>

      {/* KPIs Principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Eventos</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.total_events.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Últimos {dateRange} días
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversiones</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.conversions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Registros + Compras
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Conversión</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversionRate}%</div>
            <p className="text-xs text-muted-foreground">
              Conversiones / Total eventos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${metrics.total_value.toLocaleString()} MXN
            </div>
            <p className="text-xs text-muted-foreground">
              Ingresos del período
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs para diferentes visualizaciones */}
      <Tabs defaultValue="trends" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="trends">Tendencias</TabsTrigger>
          <TabsTrigger value="funnel">Embudo</TabsTrigger>
          <TabsTrigger value="events">Eventos</TabsTrigger>
          <TabsTrigger value="table">Tabla</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tendencia Diaria</CardTitle>
              <CardDescription>Eventos totales y conversiones por día</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metrics.daily_trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => format(new Date(value), "dd MMM", { locale: es })}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => format(new Date(value), "dd MMMM yyyy", { locale: es })}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="total_events" 
                    stroke="#3b82f6" 
                    name="Total Eventos"
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="conversions" 
                    stroke="#10b981" 
                    name="Conversiones"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="funnel" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Embudo de Conversión</CardTitle>
              <CardDescription>Flujo de usuarios desde vista hasta compra</CardDescription>
            </CardHeader>
            <CardContent>
              {funnelData.length > 0 ? (
                <div className="space-y-4">
                  {funnelData.map((item, index) => {
                    const percentage = index === 0 
                      ? 100 
                      : ((item.value / funnelData[0].value) * 100).toFixed(1);
                    const dropOff = index > 0 
                      ? (((funnelData[index - 1].value - item.value) / funnelData[index - 1].value) * 100).toFixed(1)
                      : null;

                    return (
                      <div key={item.name} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{item.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold">{item.value.toLocaleString()}</span>
                            <Badge variant="secondary">{percentage}%</Badge>
                            {dropOff && (
                              <Badge variant="destructive">-{dropOff}%</Badge>
                            )}
                          </div>
                        </div>
                        <div className="h-12 bg-muted rounded-lg overflow-hidden">
                          <div 
                            className="h-full flex items-center justify-center text-white font-semibold transition-all duration-500"
                            style={{ 
                              width: `${percentage}%`,
                              backgroundColor: item.fill,
                            }}
                          >
                            {percentage}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No hay datos suficientes para mostrar el embudo
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Distribución de Eventos</CardTitle>
              <CardDescription>Cantidad de eventos por tipo</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.events_by_type}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="event_type" 
                    tickFormatter={(value) => EVENT_LABELS[value] || value}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => EVENT_LABELS[value] || value}
                  />
                  <Bar dataKey="count" name="Cantidad">
                    {metrics.events_by_type.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={EVENT_COLORS[entry.event_type] || "#6366f1"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="table" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Eventos Recientes</CardTitle>
              <CardDescription>Últimos 50 eventos de conversión</CardDescription>
              <div className="flex flex-wrap items-center gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filtrar por tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los eventos</SelectItem>
                      {Object.entries(EVENT_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={eventSourceFilter} onValueChange={setEventSourceFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filtrar por fuente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las fuentes</SelectItem>
                      <SelectItem value="facebook_pixel">Facebook Pixel</SelectItem>
                      <SelectItem value="google_analytics">Google Analytics</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha/Hora</TableHead>
                      <TableHead>Tipo de Evento</TableHead>
                      <TableHead>Fuente</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Contenido</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentEvents.length > 0 ? (
                      recentEvents.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className="text-xs">
                            {format(new Date(event.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              style={{ 
                                backgroundColor: EVENT_COLORS[event.event_type] || "#6366f1",
                                color: "white",
                              }}
                            >
                              {EVENT_LABELS[event.event_type] || event.event_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={event.event_source === 'facebook_pixel' ? 'default' : 'secondary'}
                            >
                              {event.event_source === 'facebook_pixel' ? 'FB' : 'GA4'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {event.user_email || "Anónimo"}
                            {event.user_role && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                {event.user_role}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">
                            {event.content_name || "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {event.value ? `$${event.value.toLocaleString()} ${event.currency}` : "-"}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No hay eventos registrados
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
