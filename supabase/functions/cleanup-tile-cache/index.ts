/**
 * 🧹 Cron job para limpiar tiles expirados del cache
 * - Se ejecuta cada hora via pg_cron
 * - Elimina tiles con expires_at < now()
 * - Mantiene el cache limpio y performante
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[cleanup-tile-cache] Iniciando limpieza de tiles expirados...');

    // Ejecutar función de limpieza
    const { data, error } = await supabase.rpc('cleanup_expired_tiles');

    if (error) {
      console.error('[cleanup-tile-cache] Error:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message,
          deletedCount: 0 
        }),
        { 
          headers: { 'Content-Type': 'application/json' },
          status: 500
        }
      );
    }

    const deletedCount = data || 0;
    console.log(`[cleanup-tile-cache] ✅ Eliminados ${deletedCount} tiles expirados`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        deletedCount,
        message: `Limpieza exitosa: ${deletedCount} tiles eliminados`
      }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('[cleanup-tile-cache] Exception:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        deletedCount: 0
      }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});