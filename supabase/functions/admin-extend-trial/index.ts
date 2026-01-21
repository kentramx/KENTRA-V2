import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, getClientIP, rateLimitedResponse, apiRateLimit } from "../_shared/rateLimit.ts";
import { isUUID, isInteger } from "../_shared/validation.ts";

interface ExtendTrialRequest {
  userId: string;
  days: number;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting for API operations
  const clientIP = getClientIP(req);
  const rateResult = checkRateLimit(clientIP, apiRateLimit);
  if (!rateResult.allowed) {
    return rateLimitedResponse(rateResult, corsHeaders);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify admin access
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is super_admin
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: isSuperAdmin } = await adminClient.rpc("is_super_admin", {
      _user_id: user.id,
    });

    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: "Access denied. Super admin required." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, days }: ExtendTrialRequest = await req.json();

    // Input validation
    if (!userId || !isUUID(userId)) {
      return new Response(
        JSON.stringify({ error: "userId must be a valid UUID" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!isInteger(days) || days <= 0 || days > 90) {
      return new Response(
        JSON.stringify({ error: "days must be an integer between 1 and 90" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get current subscription
    const { data: subscription, error: subError } = await adminClient
      .from("user_subscriptions")
      .select("*, subscription_plans(name)")
      .eq("user_id", userId)
      .single();

    if (subError || !subscription) {
      return new Response(
        JSON.stringify({ error: "Subscription not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (subscription.status !== "trialing") {
      return new Response(
        JSON.stringify({ error: "Only trial subscriptions can be extended" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Calculate new end date
    const currentEnd = new Date(subscription.current_period_end);
    const newEnd = new Date(currentEnd.getTime() + days * 24 * 60 * 60 * 1000);

    // Update subscription
    const { error: updateError } = await adminClient
      .from("user_subscriptions")
      .update({
        current_period_end: newEnd.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);

    if (updateError) {
      console.error("Error updating subscription:", updateError);
      throw updateError;
    }

    // Log the change
    await adminClient.from("subscription_changes").insert({
      user_id: userId,
      change_type: "trial_extended",
      previous_plan_id: subscription.plan_id,
      new_plan_id: subscription.plan_id,
      previous_billing_cycle: subscription.billing_cycle || "monthly",
      new_billing_cycle: subscription.billing_cycle || "monthly",
      metadata: {
        extended_by_admin: user.id,
        days_added: days,
        previous_end: subscription.current_period_end,
        new_end: newEnd.toISOString(),
      },
    });

    console.log(`[admin-extend-trial] Extended trial for user ${userId} by ${days} days. New end: ${newEnd.toISOString()}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Trial extended by ${days} days`,
        newEndDate: newEnd.toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("[admin-extend-trial] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
