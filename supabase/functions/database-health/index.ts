/**
 * Edge Function: database-health
 * Returns database health metrics for monitoring
 *
 * Use for: Monitoring dashboards, alerts, health checks
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, getClientIP, rateLimitedResponse, apiRateLimit } from "../_shared/rateLimit.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting
  const clientIP = getClientIP(req);
  const rateResult = checkRateLimit(clientIP, apiRateLimit);
  if (!rateResult.allowed) {
    return rateLimitedResponse(rateResult, corsHeaders);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify admin access (optional, can be removed for public health endpoint)
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        // Continue without admin check for basic health
      } else {
        // Check if admin for detailed info
        const { data: isAdmin } = await supabase.rpc("has_admin_access", { _user_id: user.id });

        if (isAdmin) {
          // Return detailed health for admins
          const { data: health, error } = await supabase.rpc("get_database_health");

          if (error) throw error;

          return new Response(
            JSON.stringify({
              status: "healthy",
              detailed: true,
              ...health,
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }
    }

    // Basic health check for non-admins
    const startTime = Date.now();

    // Simple query to verify database connectivity
    const { count, error } = await supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("status", "activa")
      .limit(1);

    const latency = Date.now() - startTime;

    if (error) throw error;

    return new Response(
      JSON.stringify({
        status: "healthy",
        detailed: false,
        latency_ms: latency,
        active_properties: count,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[database-health] Error:", errorMessage);

    return new Response(
      JSON.stringify({
        status: "unhealthy",
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
