import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * BUMP PROPERTY (IMPULSO MANUAL)
 * 
 * Permite a un agente "impulsar" una propiedad específica,
 * actualizando su last_renewed_at y expires_at.
 * 
 * Límites según plan:
 * - Trial: 0 impulsos
 * - Start: 3 impulsos/mes
 * - Pro: 10 impulsos/mes
 * - Elite: ilimitados (-1)
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { propertyId } = await req.json();

    if (!propertyId) {
      return new Response(
        JSON.stringify({ success: false, error: 'propertyId requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Crear cliente con token del usuario para que auth.uid() funcione en RPC
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: { Authorization: authHeader },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    console.log('[bump-property] Bumping property:', propertyId);

    // Llamar a la función RPC
    const { data, error } = await supabase.rpc('bump_property', {
      property_id: propertyId,
    });

    if (error) {
      console.error('[bump-property] RPC Error:', error);
      throw error;
    }

    console.log('[bump-property] Result:', data);

    const result = data as {
      success: boolean;
      error?: string;
      bumps_used?: number;
      bumps_limit?: number;
      bumps_remaining?: number;
      next_reset?: string;
    };

    if (!result.success) {
      return new Response(
        JSON.stringify(result),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[bump-property] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
