import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, getClientIP, rateLimitedResponse, apiRateLimit } from "../_shared/rateLimit.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
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
    // Crear cliente de Supabase con service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('Iniciando refresh de materialized views...');

    // Refresh de la vista de estadísticas por municipio
    const { error: municipalityError } = await supabaseAdmin.rpc('exec_sql', {
      sql: 'REFRESH MATERIALIZED VIEW CONCURRENTLY property_stats_by_municipality'
    });

    if (municipalityError) {
      // Intentar sin CONCURRENTLY si falla
      const { error: retryError } = await supabaseAdmin.rpc('exec_sql', {
        sql: 'REFRESH MATERIALIZED VIEW property_stats_by_municipality'
      });
      
      if (retryError) {
        throw new Error(`Error refreshing municipality stats: ${retryError.message}`);
      }
    }

    console.log('✅ property_stats_by_municipality refreshed');

    // Refresh de la vista de estadísticas por estado
    const { error: stateError } = await supabaseAdmin.rpc('exec_sql', {
      sql: 'REFRESH MATERIALIZED VIEW CONCURRENTLY property_stats_by_state'
    });

    if (stateError) {
      // Intentar sin CONCURRENTLY si falla
      const { error: retryError } = await supabaseAdmin.rpc('exec_sql', {
        sql: 'REFRESH MATERIALIZED VIEW property_stats_by_state'
      });
      
      if (retryError) {
        throw new Error(`Error refreshing state stats: ${retryError.message}`);
      }
    }

    console.log('✅ property_stats_by_state refreshed');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Materialized views refreshed successfully',
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error en refresh-stats-views:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
