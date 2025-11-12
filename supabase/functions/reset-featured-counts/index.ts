import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
