/**
 * Edge Function: refresh-materialized-views
 * Cron job to refresh materialized views for cached stats
 *
 * Schedule: Every 5 minutes via Supabase cron
 * pg_cron: SELECT cron.schedule('refresh-mv', '0/5 * * * *', ...);
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Call the refresh function
    const { data, error } = await supabase.rpc("refresh_all_materialized_views");

    if (error) {
      console.error("[refresh-materialized-views] RPC error:", error);
      throw error;
    }

    const duration = Date.now() - startTime;
    console.log(`[refresh-materialized-views] Completed in ${duration}ms:`, data);

    return new Response(
      JSON.stringify({
        success: true,
        duration_ms: duration,
        results: data,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[refresh-materialized-views] Error:", errorMessage);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
