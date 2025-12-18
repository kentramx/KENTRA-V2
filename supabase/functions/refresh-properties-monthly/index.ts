import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
