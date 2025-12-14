import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    if (!action || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing action or userId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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

    let result: any = { success: true };

    switch (action) {
      case "cancel": {
        if (subscription.stripe_subscription_id) {
          // Cancel at period end in Stripe
          await stripe.subscriptions.update(subscription.stripe_subscription_id, {
            cancel_at_period_end: true,
          });
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
          await stripe.subscriptions.update(subscription.stripe_subscription_id, {
            cancel_at_period_end: false,
          });
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
          await stripe.subscriptions.update(subscription.stripe_subscription_id, {
            items: [
              {
                id: stripeSubscription.items.data[0].id,
                price: priceId,
              },
            ],
            proration_behavior: "create_prorations",
          });
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
