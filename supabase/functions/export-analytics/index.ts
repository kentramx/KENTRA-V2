import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, getClientIP, rateLimitedResponse, apiRateLimit } from "../_shared/rateLimit.ts";

interface AgentStats {
  total_properties: number;
  active_properties: number;
  total_views: number;
  total_favorites: number;
  total_conversations: number;
  conversion_rate: number;
}

interface PropertyPerformance {
  title: string;
  views: number;
  favorites: number;
  conversations: number;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting for API operations
  const clientIP = getClientIP(req);
  const rateResult = checkRateLimit(clientIP, apiRateLimit);
  if (!rateResult.allowed) {
    return rateLimitedResponse(rateResult, corsHeaders);
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { format = 'csv' } = await req.json();

    console.log(`Exporting analytics for agent ${user.id} in format ${format}`);

    // Get agent stats
    const { data: statsData, error: statsError } = await supabaseClient
      .rpc('get_agent_stats', { agent_uuid: user.id });

    if (statsError) throw statsError;

    const stats: AgentStats = statsData?.[0] || {
      total_properties: 0,
      active_properties: 0,
      total_views: 0,
      total_favorites: 0,
      total_conversations: 0,
      conversion_rate: 0,
    };

    // Get property performance - limit to prevent OOM with 1M+ properties
    const { data: propertiesData, error: propertiesError } = await supabaseClient
      .from('properties')
      .select('id, title')
      .eq('agent_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1000); // Limit to 1000 most recent properties

    if (propertiesError) throw propertiesError;

    const propertyPerformance: PropertyPerformance[] = [];
    const propertyIds = propertiesData?.map(p => p.id) || [];
    
    if (propertyIds.length === 0) {
      // No properties, return empty analytics
      if (format === 'csv') {
        const csv = generateEmptyCSV(stats);
        return new Response(csv, {
          status: 200,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="analytics-report-${new Date().toISOString().split('T')[0]}.csv"`
          },
        });
      } else {
        return new Response(JSON.stringify({
          stats,
          propertyPerformance: [],
          generatedAt: new Date().toISOString(),
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Create a map of property ID to title
    const propertyTitleMap = new Map(propertiesData?.map(p => [p.id, p.title]) || []);

    // Get counts with proper filtering by property IDs
    const { data: viewCounts } = await supabaseClient
      .from('property_views')
      .select('property_id')
      .in('property_id', propertyIds);

    const viewMap = new Map();
    viewCounts?.forEach((v: any) => {
      const propId = v.property_id;
      viewMap.set(propId, (viewMap.get(propId) || 0) + 1);
    });

    // Get favorite counts
    const { data: favCounts } = await supabaseClient
      .from('favorites')
      .select('property_id')
      .in('property_id', propertyIds);

    const favMap = new Map();
    favCounts?.forEach((f: any) => {
      const propId = f.property_id;
      favMap.set(propId, (favMap.get(propId) || 0) + 1);
    });

    // Get conversation counts
    const { data: convCounts } = await supabaseClient
      .from('conversations')
      .select('property_id')
      .in('property_id', propertyIds);

    const convMap = new Map();
    convCounts?.forEach((c: any) => {
      const propId = c.property_id;
      convMap.set(propId, (convMap.get(propId) || 0) + 1);
    });

    // Build final array with aggregated data
    propertiesData?.forEach((property: any) => {
      propertyPerformance.push({
        title: property.title,
        views: viewMap.get(property.id) || 0,
        favorites: favMap.get(property.id) || 0,
        conversations: convMap.get(property.id) || 0,
      });
    });

    if (format === 'csv') {
      // Generate CSV
      const csvLines = [
        'REPORTE DE ANALÍTICAS DEL AGENTE',
        '',
        'ESTADÍSTICAS GENERALES',
        'Métrica,Valor',
        `Total de Propiedades,${stats.total_properties}`,
        `Propiedades Activas,${stats.active_properties}`,
        `Total de Vistas,${stats.total_views}`,
        `Total de Favoritos,${stats.total_favorites}`,
        `Total de Conversaciones,${stats.total_conversations}`,
        `Tasa de Conversión,${stats.conversion_rate}%`,
        '',
        'RENDIMIENTO POR PROPIEDAD',
        'Propiedad,Vistas,Favoritos,Conversaciones',
        ...propertyPerformance.map(
          (p) => `"${p.title}",${p.views},${p.favorites},${p.conversations}`
        ),
      ];

      const csv = csvLines.join('\n');

      return new Response(csv, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="analytics-report-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    } else {
      // Return JSON format
      const reportData = {
        stats,
        propertyPerformance,
        generatedAt: new Date().toISOString(),
      };

      return new Response(JSON.stringify(reportData), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }
  } catch (error: any) {
    console.error('Error in export-analytics function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateEmptyCSV(stats: AgentStats): string {
  const csvLines = [
    'REPORTE DE ANALÍTICAS DEL AGENTE',
    '',
    'ESTADÍSTICAS GENERALES',
    'Métrica,Valor',
    `Total de Propiedades,${stats.total_properties}`,
    `Propiedades Activas,${stats.active_properties}`,
    `Total de Vistas,${stats.total_views}`,
    `Total de Favoritos,${stats.total_favorites}`,
    `Total de Conversaciones,${stats.total_conversations}`,
    `Tasa de Conversión,${stats.conversion_rate}%`,
    '',
    'RENDIMIENTO POR PROPIEDAD',
    'No hay propiedades para mostrar',
  ];
  return csvLines.join('\n');
}
