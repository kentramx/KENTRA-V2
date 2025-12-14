import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SubscriptionMetrics {
  totalSubscriptions: number;
  activeCount: number;
  trialingCount: number;
  pastDueCount: number;
  canceledThisMonth: number;
  suspendedCount: number;
  mrr: number;
  churnRate: number;
}

interface SubscriptionData {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  created_at: string;
  user_name: string;
  user_email: string;
  plan_name: string;
  plan_display_name: string;
  price_monthly: number;
  price_yearly: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    // Fetch all subscriptions with related data
    const { data: subscriptions, error: subsError } = await adminClient
      .from("user_subscriptions")
      .select(`
        id,
        user_id,
        plan_id,
        status,
        billing_cycle,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
        stripe_subscription_id,
        stripe_customer_id,
        created_at,
        profiles!user_subscriptions_user_id_fkey (
          name
        ),
        subscription_plans (
          name,
          display_name,
          price_monthly,
          price_yearly
        )
      `)
      .order("created_at", { ascending: false });

    if (subsError) {
      console.error("Error fetching subscriptions:", subsError);
      throw subsError;
    }

    // Get user emails from auth.users
    const userIds = [...new Set(subscriptions?.map((s: any) => s.user_id) || [])];
    const userEmails: Record<string, string> = {};

    for (const userId of userIds) {
      const { data: authUser } = await adminClient.auth.admin.getUserById(userId);
      if (authUser?.user?.email) {
        userEmails[userId] = authUser.user.email;
      }
    }

    // Transform subscriptions data
    const transformedSubscriptions: SubscriptionData[] = (subscriptions || []).map((sub: any) => ({
      id: sub.id,
      user_id: sub.user_id,
      plan_id: sub.plan_id,
      status: sub.status,
      billing_cycle: sub.billing_cycle || "monthly",
      current_period_start: sub.current_period_start,
      current_period_end: sub.current_period_end,
      cancel_at_period_end: sub.cancel_at_period_end || false,
      stripe_subscription_id: sub.stripe_subscription_id,
      stripe_customer_id: sub.stripe_customer_id,
      created_at: sub.created_at,
      user_name: sub.profiles?.name || "Usuario",
      user_email: userEmails[sub.user_id] || "Sin email",
      plan_name: sub.subscription_plans?.name || "",
      plan_display_name: sub.subscription_plans?.display_name || "Sin plan",
      price_monthly: sub.subscription_plans?.price_monthly || 0,
      price_yearly: sub.subscription_plans?.price_yearly || 0,
    }));

    // Calculate metrics
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const activeCount = transformedSubscriptions.filter(
      (s) => s.status === "active" && !s.cancel_at_period_end
    ).length;

    const trialingCount = transformedSubscriptions.filter(
      (s) => s.status === "trialing"
    ).length;

    const pastDueCount = transformedSubscriptions.filter(
      (s) => s.status === "past_due"
    ).length;

    const suspendedCount = transformedSubscriptions.filter(
      (s) => s.status === "suspended"
    ).length;

    // Count canceled in last 30 days
    const { data: canceledRecent } = await adminClient
      .from("subscription_changes")
      .select("id")
      .eq("change_type", "canceled")
      .gte("changed_at", thirtyDaysAgo.toISOString());

    const canceledThisMonth = canceledRecent?.length || 0;

    // Calculate MRR (Monthly Recurring Revenue)
    const mrr = transformedSubscriptions
      .filter((s) => s.status === "active" && !s.cancel_at_period_end)
      .reduce((acc, s) => {
        if (s.billing_cycle === "yearly") {
          return acc + (s.price_yearly || 0) / 12;
        }
        return acc + (s.price_monthly || 0);
      }, 0);

    // Calculate churn rate (canceled in last 30 days / total active at start of period)
    const totalActiveStart = activeCount + canceledThisMonth;
    const churnRate = totalActiveStart > 0 
      ? (canceledThisMonth / totalActiveStart) * 100 
      : 0;

    const metrics: SubscriptionMetrics = {
      totalSubscriptions: transformedSubscriptions.length,
      activeCount,
      trialingCount,
      pastDueCount,
      canceledThisMonth,
      suspendedCount,
      mrr: Math.round(mrr * 100) / 100,
      churnRate: Math.round(churnRate * 100) / 100,
    };

    // Get all plans for filter dropdown
    const { data: plans } = await adminClient
      .from("subscription_plans")
      .select("id, name, display_name")
      .eq("is_active", true)
      .order("price_monthly", { ascending: true });

    console.log(`[admin-get-subscriptions] Fetched ${transformedSubscriptions.length} subscriptions, MRR: $${metrics.mrr}`);

    return new Response(
      JSON.stringify({
        subscriptions: transformedSubscriptions,
        metrics,
        plans: plans || [],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("[admin-get-subscriptions] Error:", error);
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
