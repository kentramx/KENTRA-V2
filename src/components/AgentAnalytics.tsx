import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { WhatsAppAnalytics } from "./WhatsAppAnalytics";
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
  Cell,
} from "recharts";
import {
  TrendingUp,
  Eye,
  Heart,
  MessageSquare,
  Home,
  Percent,
  Download,
  FileText,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface AgentStats {
  total_properties: number;
  active_properties: number;
  total_views: number;
  total_favorites: number;
  total_conversations: number;
  conversion_rate: number;
}

interface PropertyPerformance {
  id: string;
  title: string;
  views: number;
  favorites: number;
  conversations: number;
}

interface ViewsOverTime {
  date: string;
  views: number;
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

export const AgentAnalytics = ({ agentId }: { agentId: string }) => {
  const { error: logError, captureException } = useMonitoring();
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [propertyPerformance, setPropertyPerformance] = useState<PropertyPerformance[]>([]);
  const [viewsOverTime, setViewsOverTime] = useState<ViewsOverTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [agentId]);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-analytics', {
        body: { format: 'csv' },
      });

      if (error) throw error;

      // Create blob and download
      const blob = new Blob([data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Reporte exportado",
        description: "El reporte CSV ha sido descargado exitosamente",
      });
    } catch (error) {
      logError("Error exporting CSV", {
        component: "AgentAnalytics",
        agentId,
        error,
      });
      captureException(error as Error, {
        component: "AgentAnalytics",
        action: "exportCSV",
        agentId,
      });
      toast({
        title: "Error",
        description: "No se pudo exportar el reporte",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-analytics', {
        body: { format: 'json' },
      });

      if (error) throw error;

      // Generate PDF using jsPDF
      const doc = new jsPDF();
      
      // Title
      doc.setFontSize(20);
      doc.text('Reporte de Analíticas del Agente', 14, 20);
      
      doc.setFontSize(12);
      doc.text(`Generado: ${new Date().toLocaleDateString('es-MX')}`, 14, 30);

      // Stats section
      doc.setFontSize(16);
      doc.text('Estadísticas Generales', 14, 45);
      
      const statsData = [
        ['Total de Propiedades', data.stats.total_properties],
        ['Propiedades Activas', data.stats.active_properties],
        ['Total de Vistas', data.stats.total_views],
        ['Total de Favoritos', data.stats.total_favorites],
        ['Total de Conversaciones', data.stats.total_conversations],
        ['Tasa de Conversión', `${data.stats.conversion_rate}%`],
      ];

      autoTable(doc, {
        startY: 50,
        head: [['Métrica', 'Valor']],
        body: statsData,
        theme: 'grid',
      });

      // Property performance section
      doc.setFontSize(16);
      const finalY = (doc as any).lastAutoTable.finalY || 50;
      doc.text('Rendimiento por Propiedad', 14, finalY + 15);

      const propertyData = data.propertyPerformance.map((p: any) => [
        p.title.length > 40 ? p.title.substring(0, 40) + '...' : p.title,
        p.views,
        p.favorites,
        p.conversations,
      ]);

      autoTable(doc, {
        startY: finalY + 20,
        head: [['Propiedad', 'Vistas', 'Favoritos', 'Conversaciones']],
        body: propertyData,
        theme: 'grid',
      });

      doc.save(`analytics-report-${new Date().toISOString().split('T')[0]}.pdf`);

      toast({
        title: "Reporte exportado",
        description: "El reporte PDF ha sido descargado exitosamente",
      });
    } catch (error) {
      logError("Error exporting PDF", {
        component: "AgentAnalytics",
        agentId,
        error,
      });
      captureException(error as Error, {
        component: "AgentAnalytics",
        action: "exportPDF",
        agentId,
      });
      toast({
        title: "Error",
        description: "No se pudo exportar el reporte",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      // Fetch overall stats
      const { data: statsData, error: statsError } = await supabase
        .rpc("get_agent_stats", { agent_uuid: agentId });

      if (statsError) throw statsError;
      setStats(statsData?.[0] || null);

      // Fetch property performance with individual queries for each metric
      const { data: propertiesData, error: propertiesError } = await supabase
        .from("properties")
        .select("id, title")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (propertiesError) throw propertiesError;

      // For each property, fetch views, favorites, and conversations counts
      const performance = await Promise.all(
        (propertiesData || []).map(async (property) => {
          const [viewsResult, favoritesResult, conversationsResult] = await Promise.all([
            supabase
              .from("property_views")
              .select("id", { count: "exact", head: true })
              .eq("property_id", property.id),
            supabase
              .from("favorites")
              .select("id", { count: "exact", head: true })
              .eq("property_id", property.id),
            supabase
              .from("conversations")
              .select("id", { count: "exact", head: true })
              .eq("property_id", property.id),
          ]);

          return {
            id: property.id,
            title: property.title.length > 30 ? property.title.substring(0, 30) + "..." : property.title,
            views: viewsResult.count || 0,
            favorites: favoritesResult.count || 0,
            conversations: conversationsResult.count || 0,
          };
        })
      );

      // Sort by views descending
      performance.sort((a, b) => b.views - a.views);
      setPropertyPerformance(performance);

      // Fetch views over time (last 30 days) - only for agent's properties
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // First get all property IDs for this agent
      const { data: agentProperties } = await supabase
        .from("properties")
        .select("id")
        .eq("agent_id", agentId);

      const propertyIds = agentProperties?.map(p => p.id) || [];

      if (propertyIds.length > 0) {
        const { data: viewsData, error: viewsError } = await supabase
          .from("property_views")
          .select("viewed_at, property_id")
          .in("property_id", propertyIds)
          .gte("viewed_at", thirtyDaysAgo.toISOString())
          .order("viewed_at", { ascending: true });

        if (viewsError) throw viewsError;

        // Group views by date
        const viewsByDate: { [key: string]: number } = {};
        viewsData?.forEach((view: any) => {
          const date = new Date(view.viewed_at).toISOString().split('T')[0];
          viewsByDate[date] = (viewsByDate[date] || 0) + 1;
        });

        // Fill in missing dates with 0 views
        const viewsTimeData: ViewsOverTime[] = [];
        for (let i = 29; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          viewsTimeData.push({
            date: date.toLocaleDateString("es-MX", { month: 'short', day: 'numeric' }),
            views: viewsByDate[dateStr] || 0,
          });
        }

        setViewsOverTime(viewsTimeData);
      } else {
        setViewsOverTime([]);
      }
    } catch (error) {
      logError("Error fetching analytics", {
        component: "AgentAnalytics",
        agentId,
        error,
      });
      captureException(error as Error, {
        component: "AgentAnalytics",
        action: "fetchAnalytics",
        agentId,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return <div className="text-center py-8">Cargando analíticas...</div>;
  }

  const statCards = [
    {
      title: "Total de Propiedades",
      value: stats.total_properties,
      icon: Home,
      color: "text-blue-500",
    },
    {
      title: "Vistas Totales",
      value: stats.total_views,
      icon: Eye,
      color: "text-green-500",
    },
    {
      title: "Favoritos",
      value: stats.total_favorites,
      icon: Heart,
      color: "text-red-500",
    },
    {
      title: "Conversaciones",
      value: stats.total_conversations,
      icon: MessageSquare,
      color: "text-purple-500",
    },
    {
      title: "Tasa de Conversión",
      value: `${stats.conversion_rate}%`,
      icon: Percent,
      color: "text-yellow-500",
    },
  ];

  const pieData = [
    { name: "Activas", value: stats.active_properties },
    { name: "Otras", value: stats.total_properties - stats.active_properties },
  ];

  return (
    <div className="space-y-6">
      {/* Best Performing Property Card */}
      {propertyPerformance.length > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Mejor Propiedad del Mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">{propertyPerformance[0].title}</h3>
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{propertyPerformance[0].views}</p>
                    <p className="text-sm text-muted-foreground">Vistas</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-red-500" />
                  <div>
                    <p className="text-2xl font-bold">{propertyPerformance[0].favorites}</p>
                    <p className="text-sm text-muted-foreground">Favoritos</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-purple-500" />
                  <div>
                    <p className="text-2xl font-bold">{propertyPerformance[0].conversations}</p>
                    <p className="text-sm text-muted-foreground">Leads</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export Buttons */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 justify-end">
            <Button
              variant="outline"
              onClick={handleExportCSV}
              disabled={exporting}
            >
              <FileText className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
            <Button
              variant="outline"
              onClick={handleExportPDF}
              disabled={exporting}
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                {stat.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="performance">Rendimiento</TabsTrigger>
          <TabsTrigger value="trends">Tendencias</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Estado de Propiedades</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Métricas de Engagement</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={[
                      {
                        name: "Métricas",
                        Vistas: stats.total_views,
                        Favoritos: stats.total_favorites,
                        Conversaciones: stats.total_conversations,
                      },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Vistas" fill="#0088FE" />
                    <Bar dataKey="Favoritos" fill="#00C49F" />
                    <Bar dataKey="Conversaciones" fill="#FFBB28" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Propiedades por Vistas</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={propertyPerformance} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="title" type="category" width={150} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="views" fill="#0088FE" name="Vistas" />
                  <Bar dataKey="favorites" fill="#00C49F" name="Favoritos" />
                  <Bar dataKey="conversations" fill="#FFBB28" name="Mensajes" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vistas en los Últimos 30 Días</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={viewsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="views"
                    stroke="#8884d8"
                    strokeWidth={2}
                    name="Vistas"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp" className="space-y-4">
          <WhatsAppAnalytics agentId={agentId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};