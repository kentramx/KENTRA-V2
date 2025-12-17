import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from '../_shared/logger.ts';

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

// Mensajes de error amigables para el usuario
const ERROR_MESSAGES = {
  NO_AUTH: 'Se requiere autenticación para acceder a este recurso',
  UNAUTHORIZED: 'No tienes permisos para acceder a esta información',
  ADMIN_REQUIRED: 'Se requiere rol de super administrador',
  FETCH_ERROR: 'Error al obtener las suscripciones. Por favor intenta de nuevo.',
  INTERNAL_ERROR: 'Error interno del servidor. Contacta soporte si persiste.',
} as const;

serve(async (req) => {
  const logger = createLogger('admin-get-subscriptions');

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Parse query params for pagination
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '50', 10), 100);
    const statusFilter = url.searchParams.get('status') || null;
    const planFilter = url.searchParams.get('planId') || null;
    const searchQuery = url.searchParams.get('search') || null;

    // Verify admin access
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: ERROR_MESSAGES.NO_AUTH }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: ERROR_MESSAGES.UNAUTHORIZED }), {
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
      logger.warn('Access denied - not super admin', { userId: user.id });
      return new Response(JSON.stringify({ error: ERROR_MESSAGES.ADMIN_REQUIRED }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build query with filters
    let query = adminClient
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
      `, { count: 'exact' });

    // Apply filters
    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }
    if (planFilter) {
      query = query.eq('plan_id', planFilter);
    }

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    
    const { data: subscriptions, error: subsError, count: totalCount } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (subsError) {
      logger.error('Error fetching subscriptions', {}, subsError as Error);
      return new Response(JSON.stringify({ error: ERROR_MESSAGES.FETCH_ERROR }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user emails from auth.users (only for current page)
    const userIds = [...new Set(subscriptions?.map((s: any) => s.user_id) || [])];
    const userEmails: Record<string, string> = {};

    // Batch fetch emails (max 50 at a time to avoid rate limits)
    for (let i = 0; i < userIds.length; i += 50) {
      const batch = userIds.slice(i, i + 50);
      await Promise.all(
        batch.map(async (userId) => {
          const { data: authUser } = await adminClient.auth.admin.getUserById(userId);
          if (authUser?.user?.email) {
            userEmails[userId] = authUser.user.email;
          }
        })
      );
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

    // Calculate metrics (use cached/aggregated data for performance on large datasets)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get aggregated counts efficiently
    const [
      { count: activeCount },
      { count: trialingCount },
      { count: pastDueCount },
      { count: suspendedCount },
      { count: canceledCount },
    ] = await Promise.all([
      adminClient.from("user_subscriptions").select('*', { count: 'exact', head: true }).eq('status', 'active').eq('cancel_at_period_end', false),
      adminClient.from("user_subscriptions").select('*', { count: 'exact', head: true }).eq('status', 'trialing'),
      adminClient.from("user_subscriptions").select('*', { count: 'exact', head: true }).eq('status', 'past_due'),
      adminClient.from("user_subscriptions").select('*', { count: 'exact', head: true }).eq('status', 'suspended'),
      adminClient.from("subscription_changes").select('*', { count: 'exact', head: true }).eq('change_type', 'canceled').gte('changed_at', thirtyDaysAgo.toISOString()),
    ]);

    // Calculate MRR from active subscriptions
    const { data: activeForMrr } = await adminClient
      .from("user_subscriptions")
      .select(`
        billing_cycle,
        subscription_plans (price_monthly, price_yearly)
      `)
      .eq('status', 'active')
      .eq('cancel_at_period_end', false);

    const mrr = (activeForMrr || []).reduce((acc, s: any) => {
      if (s.billing_cycle === "yearly") {
        return acc + (s.subscription_plans?.price_yearly || 0) / 12;
      }
      return acc + (s.subscription_plans?.price_monthly || 0);
    }, 0);

    // Calculate churn rate
    const totalActiveStart = (activeCount || 0) + (canceledCount || 0);
    const churnRate = totalActiveStart > 0 
      ? ((canceledCount || 0) / totalActiveStart) * 100 
      : 0;

    const metrics: SubscriptionMetrics = {
      totalSubscriptions: totalCount || 0,
      activeCount: activeCount || 0,
      trialingCount: trialingCount || 0,
      pastDueCount: pastDueCount || 0,
      canceledThisMonth: canceledCount || 0,
      suspendedCount: suspendedCount || 0,
      mrr: Math.round(mrr * 100) / 100,
      churnRate: Math.round(churnRate * 100) / 100,
    };

    // Get all plans for filter dropdown
    const { data: plans } = await adminClient
      .from("subscription_plans")
      .select("id, name, display_name")
      .eq("is_active", true)
      .order("price_monthly", { ascending: true });

    logger.info('Subscriptions fetched successfully', { 
      page, 
      pageSize, 
      totalCount, 
      mrr: metrics.mrr 
    });

    return new Response(
      JSON.stringify({
        subscriptions: transformedSubscriptions,
        metrics,
        plans: plans || [],
        pagination: {
          page,
          pageSize,
          totalCount: totalCount || 0,
          totalPages: Math.ceil((totalCount || 0) / pageSize),
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    logger.error('Unexpected error', {}, error as Error);
    return new Response(
      JSON.stringify({ error: ERROR_MESSAGES.INTERNAL_ERROR }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
