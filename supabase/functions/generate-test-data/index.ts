/**
 * Edge Function: generate-test-data
 * Generates test properties for load testing
 *
 * WARNING: Only use in staging/test environments
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let count = 10000;
    let batch_size = 5000;

    try {
      const body = await req.json();
      count = body.count || 10000;
      batch_size = body.batch_size || 5000;
    } catch {
      // Use defaults
    }

    // Limit to prevent abuse
    const safeCount = Math.min(count, 100000); // Max 100K per call
    const safeBatchSize = Math.min(batch_size, 10000);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log(`[generate-test-data] Starting generation of ${safeCount} properties...`);

    const startTime = Date.now();

    const { data, error } = await supabase.rpc("generate_test_properties", {
      p_total_count: safeCount,
      p_batch_size: safeBatchSize,
    });

    if (error) {
      console.error("[generate-test-data] RPC Error:", JSON.stringify(error));
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message || JSON.stringify(error),
          details: error,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const duration = Date.now() - startTime;
    console.log(`[generate-test-data] Completed in ${duration}ms:`, data);

    return new Response(
      JSON.stringify({
        success: true,
        duration_ms: duration,
        result: data,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : "";
    console.error("[generate-test-data] Error:", errorMessage, errorStack);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        stack: err instanceof Error ? err.stack : undefined,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
