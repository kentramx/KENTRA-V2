import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";

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
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [propertyPerformance, setPropertyPerformance] = useState<PropertyPerformance[]>([]);
  const [viewsOverTime, setViewsOverTime] = useState<ViewsOverTime[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [agentId]);

  const fetchAnalytics = async () => {
    try {
      // Fetch overall stats
      const { data: statsData, error: statsError } = await supabase
        .rpc("get_agent_stats", { agent_uuid: agentId });

      if (statsError) throw statsError;
      setStats(statsData?.[0] || null);

      // Fetch property performance
      const { data: propertiesData, error: propertiesError } = await supabase
        .from("properties")
        .select(`
          id,
          title,
          property_views (count),
          favorites (count),
          conversations (count)
        `)
        .eq("agent_id", agentId)
        .limit(10);

      if (propertiesError) throw propertiesError;

      const performance = propertiesData?.map((p: any) => ({
        id: p.id,
        title: p.title.length > 30 ? p.title.substring(0, 30) + "..." : p.title,
        views: p.property_views?.[0]?.count || 0,
        favorites: p.favorites?.[0]?.count || 0,
        conversations: p.conversations?.[0]?.count || 0,
      })) || [];

      setPropertyPerformance(performance);

      // Fetch views over time (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: viewsData, error: viewsError } = await supabase
        .from("property_views")
        .select("viewed_at")
        .gte("viewed_at", thirtyDaysAgo.toISOString())
        .order("viewed_at", { ascending: true });

      if (viewsError) throw viewsError;

      // Group views by date
      const viewsByDate: { [key: string]: number } = {};
      viewsData?.forEach((view: any) => {
        const date = new Date(view.viewed_at).toLocaleDateString("es-MX");
        viewsByDate[date] = (viewsByDate[date] || 0) + 1;
      });

      const viewsTimeData = Object.entries(viewsByDate).map(([date, views]) => ({
        date,
        views,
      }));

      setViewsOverTime(viewsTimeData);
    } catch (error) {
      console.error("Error fetching analytics:", error);
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="performance">Rendimiento</TabsTrigger>
          <TabsTrigger value="trends">Tendencias</TabsTrigger>
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
      </Tabs>
    </div>
  );
};