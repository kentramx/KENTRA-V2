import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { monitoring } from '@/lib/monitoring';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
import { MessageCircle, Share2, TrendingUp, Users } from "lucide-react";

interface WhatsAppStats {
  total_clicks: number;
  contact_clicks: number;
  share_clicks: number;
  unique_users: number;
}

interface PropertyShareStats {
  property_id: string;
  property_title: string;
  total_shares: number;
  contact_clicks: number;
}

interface TimelineData {
  date: string;
  contact: number;
  share: number;
}

const COLORS = ["#25D366", "#128C7E", "#075E54", "#34B7F1"];

export const WhatsAppAnalytics = ({ agentId }: { agentId: string }) => {
  const [stats, setStats] = useState<WhatsAppStats | null>(null);
  const [propertyStats, setPropertyStats] = useState<PropertyShareStats[]>([]);
  const [timeline, setTimeline] = useState<TimelineData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWhatsAppAnalytics();
  }, [agentId]);

  const fetchWhatsAppAnalytics = async () => {
    try {
      // Fetch overall WhatsApp stats
      const { data: interactions, error: interactionsError } = await supabase
        .from("whatsapp_interactions")
        .select("*")
        .eq("agent_id", agentId);

      if (interactionsError) throw interactionsError;

      const totalClicks = interactions?.length || 0;
      const contactClicks = interactions?.filter(i => i.interaction_type === 'contact_agent').length || 0;
      const shareClicks = interactions?.filter(i => i.interaction_type === 'share_property').length || 0;
      const uniqueUsers = new Set(interactions?.map(i => i.user_id)).size || 0;

      setStats({
        total_clicks: totalClicks,
        contact_clicks: contactClicks,
        share_clicks: shareClicks,
        unique_users: uniqueUsers,
      });

      // Fetch property-level stats
      const { data: properties, error: propertiesError } = await supabase
        .from("properties")
        .select("id, title")
        .eq("agent_id", agentId);

      if (propertiesError) throw propertiesError;

      const propertyStatsData: PropertyShareStats[] = await Promise.all(
        (properties || []).map(async (property) => {
          const propertyInteractions = interactions?.filter(
            i => i.property_id === property.id
          ) || [];

          return {
            property_id: property.id,
            property_title: property.title.length > 35 
              ? property.title.substring(0, 35) + "..." 
              : property.title,
            total_shares: propertyInteractions.filter(i => i.interaction_type === 'share_property').length,
            contact_clicks: propertyInteractions.filter(i => i.interaction_type === 'contact_agent').length,
          };
        })
      );

      // Sort by total interactions (shares + contacts) descending
      propertyStatsData.sort((a, b) => 
        (b.total_shares + b.contact_clicks) - (a.total_shares + a.contact_clicks)
      );

      // Get top 10 properties
      setPropertyStats(propertyStatsData.slice(0, 10));

      // Fetch timeline data (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const timelineInteractions = interactions?.filter(
        i => new Date(i.created_at) >= thirtyDaysAgo
      ) || [];

      // Group by date
      const dataByDate: { [key: string]: { contact: number; share: number } } = {};
      timelineInteractions.forEach((interaction) => {
        const date = new Date(interaction.created_at).toISOString().split('T')[0];
        if (!dataByDate[date]) {
          dataByDate[date] = { contact: 0, share: 0 };
        }
        if (interaction.interaction_type === 'contact_agent') {
          dataByDate[date].contact++;
        } else {
          dataByDate[date].share++;
        }
      });

      // Fill in missing dates with 0
      const timelineData: TimelineData[] = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        timelineData.push({
          date: date.toLocaleDateString("es-MX", { month: 'short', day: 'numeric' }),
          contact: dataByDate[dateStr]?.contact || 0,
          share: dataByDate[dateStr]?.share || 0,
        });
      }

      setTimeline(timelineData);
    } catch (error) {
      monitoring.error("Error fetching WhatsApp analytics", { component: 'WhatsAppAnalytics', error });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Cargando analytics de WhatsApp...</div>;
  }

  if (!stats) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No hay datos de WhatsApp disponibles</p>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total de Clics",
      value: stats.total_clicks,
      icon: MessageCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Contactos Directos",
      value: stats.contact_clicks,
      icon: MessageCircle,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Compartidos",
      value: stats.share_clicks,
      icon: Share2,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Usuarios Únicos",
      value: stats.unique_users,
      icon: Users,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ];

  const interactionTypeData = [
    { name: "Contactar Agente", value: stats.contact_clicks },
    { name: "Compartir Propiedad", value: stats.share_clicks },
  ];

  return (
    <div className="space-y-6">
      {/* Best Performing Property Card */}
      {propertyStats.length > 0 && propertyStats[0].total_shares + propertyStats[0].contact_clicks > 0 && (
        <Card className="border-green-500/50 bg-green-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Propiedad Más Popular en WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">{propertyStats[0].property_title}</h3>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-purple-600" />
                  <div>
                    <p className="text-2xl font-bold">{propertyStats[0].total_shares}</p>
                    <p className="text-sm text-muted-foreground">Compartidos</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold">{propertyStats[0].contact_clicks}</p>
                    <p className="text-sm text-muted-foreground">Contactos</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className={stat.bgColor}>
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

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Interaction Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Tipo de Interacciones</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={interactionTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {interactionTypeData.map((entry, index) => (
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

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Tendencia (Últimos 30 Días)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="contact" 
                  stroke="#3B82F6" 
                  name="Contactos"
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="share" 
                  stroke="#A855F7" 
                  name="Compartidos"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Properties */}
      {propertyStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Propiedades en WhatsApp</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={propertyStats} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="property_title" type="category" width={180} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total_shares" fill="#A855F7" name="Compartidos" />
                <Bar dataKey="contact_clicks" fill="#3B82F6" name="Contactos" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Conversion Insight */}
      {stats.total_clicks > 0 && (
        <Card className="bg-blue-50/50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Insights de Conversión
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Tus propiedades han generado <span className="font-bold text-foreground">{stats.total_clicks} interacciones</span> a través de WhatsApp.
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="font-bold text-foreground">{stats.contact_clicks} usuarios</span> te contactaron directamente y{" "}
                <span className="font-bold text-foreground">{stats.share_clicks} propiedades</span> fueron compartidas.
              </p>
              <p className="text-sm text-muted-foreground">
                Esto representa un alcance de <span className="font-bold text-foreground">{stats.unique_users} usuarios únicos</span> interesados en tus propiedades.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
