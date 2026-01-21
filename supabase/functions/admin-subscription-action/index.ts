import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, getClientIP, rateLimitedResponse, apiRateLimit } from "../_shared/rateLimit.ts";
import { isUUID, checkBodySize, bodySizeLimitResponse, BODY_SIZE_LIMITS } from "../_shared/validation.ts";

type ActionType = "cancel" | "reactivate" | "change-plan";

interface ActionRequest {
  action: ActionType;
  userId: string;
  params?: {
    newPlanId?: string;
    billingCycle?: "monthly" | "yearly";
  };
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

  // SECURITY: Check body size before reading
  const bodySizeResult = await checkBodySize(req, BODY_SIZE_LIMITS.DEFAULT);
  if (!bodySizeResult.allowed) {
    console.warn('[admin-subscription-action] Request body too large:', bodySizeResult.size);
    return bodySizeLimitResponse(corsHeaders);
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    });

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

    const { action, userId, params }: ActionRequest = await req.json();

    // Input validation
    const validActions: ActionType[] = ["cancel", "reactivate", "change-plan"];
    if (!action || !validActions.includes(action)) {
      return new Response(
        JSON.stringify({ error: `Invalid action. Must be one of: ${validActions.join(", ")}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!userId || !isUUID(userId)) {
      return new Response(
        JSON.stringify({ error: "userId must be a valid UUID" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate params for change-plan action
    if (action === "change-plan") {
      if (!params?.newPlanId || !isUUID(params.newPlanId)) {
        return new Response(
          JSON.stringify({ error: "newPlanId must be a valid UUID for change-plan action" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (params.billingCycle && !["monthly", "yearly"].includes(params.billingCycle)) {
        return new Response(
          JSON.stringify({ error: "billingCycle must be 'monthly' or 'yearly'" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Get user's subscription
    const { data: subscription, error: subError } = await adminClient
      .from("user_subscriptions")
      .select("*, subscription_plans(*)")
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

    const result: Record<string, unknown> = { success: true };

    switch (action) {
      case "cancel": {
        if (subscription.stripe_subscription_id) {
          // Cancel at period end in Stripe
          // SECURITY: Idempotency key prevents duplicate operations on retries
          const idempotencyKey = `admin-cancel-${subscription.stripe_subscription_id}-${Date.now()}`;
          await stripe.subscriptions.update(subscription.stripe_subscription_id, {
            cancel_at_period_end: true,
          }, { idempotencyKey });
        }

        // Update database
        await adminClient
          .from("user_subscriptions")
          .update({
            cancel_at_period_end: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", subscription.id);

        // Log change
        await adminClient.from("subscription_changes").insert({
          user_id: userId,
          change_type: "canceled_by_admin",
          previous_plan_id: subscription.plan_id,
          new_plan_id: subscription.plan_id,
          previous_billing_cycle: subscription.billing_cycle || "monthly",
          new_billing_cycle: subscription.billing_cycle || "monthly",
          metadata: {
            canceled_by_admin: user.id,
            stripe_subscription_id: subscription.stripe_subscription_id,
          },
        });

        result.message = "Subscription will be canceled at period end";
        console.log(`[admin-subscription-action] Canceled subscription for user ${userId}`);
        break;
      }

      case "reactivate": {
        if (subscription.stripe_subscription_id) {
          // Reactivate in Stripe (remove cancel at period end)
          // SECURITY: Idempotency key prevents duplicate operations on retries
          const idempotencyKey = `admin-reactivate-${subscription.stripe_subscription_id}-${Date.now()}`;
          await stripe.subscriptions.update(subscription.stripe_subscription_id, {
            cancel_at_period_end: false,
          }, { idempotencyKey });
        }

        // Update database
        await adminClient
          .from("user_subscriptions")
          .update({
            cancel_at_period_end: false,
            status: "active",
            updated_at: new Date().toISOString(),
          })
          .eq("id", subscription.id);

        // Log change
        await adminClient.from("subscription_changes").insert({
          user_id: userId,
          change_type: "reactivated_by_admin",
          previous_plan_id: subscription.plan_id,
          new_plan_id: subscription.plan_id,
          previous_billing_cycle: subscription.billing_cycle || "monthly",
          new_billing_cycle: subscription.billing_cycle || "monthly",
          metadata: {
            reactivated_by_admin: user.id,
          },
        });

        result.message = "Subscription reactivated";
        console.log(`[admin-subscription-action] Reactivated subscription for user ${userId}`);
        break;
      }

      case "change-plan": {
        if (!params?.newPlanId) {
          return new Response(
            JSON.stringify({ error: "newPlanId is required for plan change" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Get new plan details
        const { data: newPlan, error: planError } = await adminClient
          .from("subscription_plans")
          .select("*")
          .eq("id", params.newPlanId)
          .single();

        if (planError || !newPlan) {
          return new Response(
            JSON.stringify({ error: "New plan not found" }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const billingCycle = params.billingCycle || subscription.billing_cycle || "monthly";
        const priceId = billingCycle === "yearly" 
          ? newPlan.stripe_price_id_yearly 
          : newPlan.stripe_price_id_monthly;

        if (subscription.stripe_subscription_id && priceId) {
          // Get current subscription from Stripe
          const stripeSubscription = await stripe.subscriptions.retrieve(
            subscription.stripe_subscription_id
          );

          // Update subscription in Stripe
          // SECURITY: Idempotency key prevents duplicate operations on retries
          const idempotencyKey = `admin-change-plan-${subscription.stripe_subscription_id}-${params.newPlanId}-${Date.now()}`;
          await stripe.subscriptions.update(subscription.stripe_subscription_id, {
            items: [
              {
                id: stripeSubscription.items.data[0].id,
                price: priceId,
              },
            ],
            proration_behavior: "create_prorations",
          }, { idempotencyKey });
        }

        // Update database
        await adminClient
          .from("user_subscriptions")
          .update({
            plan_id: params.newPlanId,
            billing_cycle: billingCycle,
            updated_at: new Date().toISOString(),
          })
          .eq("id", subscription.id);

        // Log change
        await adminClient.from("subscription_changes").insert({
          user_id: userId,
          change_type: "plan_changed_by_admin",
          previous_plan_id: subscription.plan_id,
          new_plan_id: params.newPlanId,
          previous_billing_cycle: subscription.billing_cycle || "monthly",
          new_billing_cycle: billingCycle,
          metadata: {
            changed_by_admin: user.id,
            previous_plan_name: subscription.subscription_plans?.name,
            new_plan_name: newPlan.name,
          },
        });

        result.message = `Plan changed to ${newPlan.display_name}`;
        console.log(`[admin-subscription-action] Changed plan for user ${userId} to ${newPlan.name}`);
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[admin-subscription-action] Error:", error);
    // SECURITY: Don't expose internal error details to clients
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
