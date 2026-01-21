import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, getClientIP, rateLimitedResponse, apiRateLimit } from "../_shared/rateLimit.ts";

/**
 * REFRESH MENSUAL UNIVERSAL
 *
 * Cron job que se ejecuta el día 1 de cada mes a las 3 AM
 * Actualiza last_renewed_at y expires_at de TODAS las propiedades activas
 * de usuarios con suscripción activa/trialing
 *
 * También resetea el contador de bumps_used_this_month
 */
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

  console.log('[refresh-properties-monthly] Starting monthly refresh...');

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Llamar a la función RPC que hace todo el trabajo
    const { data, error } = await supabaseAdmin.rpc('refresh_all_active_properties');

    if (error) {
      console.error('[refresh-properties-monthly] RPC Error:', error);
      throw error;
    }

    console.log('[refresh-properties-monthly] Completed:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Monthly refresh completed',
        ...data,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[refresh-properties-monthly] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
