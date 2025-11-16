import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { withCache } from '../_shared/redis.ts';
import { captureException, withSentry } from '../_shared/sentry.ts';

interface GlobalStats {
  totalProperties: number;
  totalAgents: number;
  avgPrice: number;
  topMunicipalities: Array<{ municipality: string; count: number }>;
  propertiesByType: Array<{ type: string; count: number }>;
}

Deno.serve(withSentry(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    // Cachear estadísticas por 1 hora (son datos agregados que no cambian frecuentemente)
    const stats = await withCache<GlobalStats>(
      'stats:global',
      3600, // 1 hora
      async () => {
        console.log('[Stats] Computing from DB...');

        // Query paralelo de todas las estadísticas
        const [
          propertiesResult,
          agentsResult,
          avgPriceResult,
          topMunicipalitiesResult,
          byTypeResult,
        ] = await Promise.all([
          // Total propiedades aprobadas
          supabase
            .from('properties')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'approved'),

          // Total agentes
          supabase
            .from('user_roles')
            .select('user_id', { count: 'exact', head: true })
            .eq('role', 'agent'),

          // Precio promedio
          supabase
            .from('properties')
            .select('price')
            .eq('status', 'approved'),

          // Top municipios
          supabase.rpc('get_top_municipalities', { limit_count: 10 }),

          // Propiedades por tipo
          supabase.rpc('get_properties_by_type'),
        ]);

        // Calcular precio promedio
        const avgPrice =
          avgPriceResult.data && avgPriceResult.data.length > 0
            ? avgPriceResult.data.reduce((sum, p) => sum + (p.price || 0), 0) /
              avgPriceResult.data.length
            : 0;

        return {
          totalProperties: propertiesResult.count || 0,
          totalAgents: agentsResult.count || 0,
          avgPrice: Math.round(avgPrice),
          topMunicipalities: topMunicipalitiesResult.data || [],
          propertiesByType: byTypeResult.data || [],
        };
      }
    );

    return new Response(JSON.stringify(stats), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // También cache en CDN/browser
      },
    });
  } catch (error) {
    console.error('[Error]', error);
    await captureException(error as Error, {
      tags: { function: 'get-cached-stats' },
    });

    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}));
