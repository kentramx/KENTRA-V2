import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, getClientIP, rateLimitedResponse, apiRateLimit } from "../_shared/rateLimit.ts";

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 Iniciando reseteo de contadores de destacadas...');

    // Resetear contadores que ya pasaron su fecha de reseteo
    const { data, error } = await supabase
      .from('user_subscriptions')
      .update({
        featured_used_this_month: 0,
        featured_reset_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()
      })
      .lte('featured_reset_date', new Date().toISOString())
      .eq('status', 'active')
      .select();

    if (error) {
      console.error('❌ Error al resetear contadores:', error);
      throw error;
    }

    const resetCount = data?.length || 0;
    console.log(`✅ Reseteados ${resetCount} contadores de destacadas`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        reset_count: resetCount,
        message: `Reseteados ${resetCount} contadores exitosamente`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error en reset-featured-counts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
