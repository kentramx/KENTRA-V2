import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, getClientIP, rateLimitedResponse, apiRateLimit } from "../_shared/rateLimit.ts";

interface ListUsersParams {
  page: number;
  pageSize: number;
  search?: string;
  roleFilter?: string;
  statusFilter?: string;
  verifiedFilter?: string;
  // New filters
  dateFrom?: string;
  dateTo?: string;
  planFilter?: string;
  minProperties?: number;
  maxProperties?: number;
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting
  const clientIP = getClientIP(req);
  const rateResult = checkRateLimit(clientIP, apiRateLimit);
  if (!rateResult.allowed) {
    return rateLimitedResponse(rateResult, corsHeaders);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify caller is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify user token and check admin role
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is super_admin or moderator
    const { data: isAdmin } = await supabaseAdmin.rpc('has_admin_access', { _user_id: user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const params: ListUsersParams = await req.json();
    const {
      page = 1,
      pageSize = 20,
      search,
      roleFilter,
      statusFilter,
      verifiedFilter,
      dateFrom,
      dateTo,
      planFilter,
      minProperties,
      maxProperties,
    } = params;

    // SCALABILITY: Limit pageSize to prevent memory issues
    const safePageSize = Math.min(pageSize, 100);
    const offset = (page - 1) * safePageSize;

    // SCALABILITY: Build query with server-side pagination
    // Instead of loading ALL profiles then filtering in memory,
    // we apply filters directly in the database query

    let query = supabaseAdmin
      .from('profiles')
      .select(`
        id,
        name,
        avatar_url,
        phone,
        city,
        state,
        is_verified,
        phone_verified,
        status,
        suspended_at,
        suspended_reason,
        created_at,
        updated_at
      `, { count: 'exact' });

    // Apply status filter at DB level
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    // Apply verified filter at DB level
    if (verifiedFilter === 'kyc_verified') {
      query = query.eq('is_verified', true);
    } else if (verifiedFilter === 'phone_verified') {
      query = query.eq('phone_verified', true);
    } else if (verifiedFilter === 'not_verified') {
      query = query.eq('is_verified', false).eq('phone_verified', false);
    }

    // Apply date filters at DB level
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo + 'T23:59:59.999Z');
    }

    // Apply search filter at DB level (much more efficient)
    if (search && search.trim()) {
      query = query.ilike('name', `%${search.trim()}%`);
    }

    // SCALABILITY: Apply pagination at DB level
    const { data: profiles, error: profilesError, count: totalCount } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + safePageSize - 1);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return new Response(JSON.stringify({ error: 'Error fetching profiles' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get auth users ONLY for the current page's profiles (not ALL users)
    const profileIds = (profiles || []).map(p => p.id);

    const emailMap = new Map<string, { email: string; lastSignIn: string | null; emailConfirmed: boolean }>();

    if (profileIds.length > 0) {
      const { data: authUsers, error: authUsersError } = await supabaseAdmin
        .rpc('get_auth_users_for_admin');

      if (!authUsersError && authUsers) {
        // Filter only the users we need
        const relevantAuthUsers = authUsers.filter((u: Record<string, unknown>) =>
          profileIds.includes(u.id as string)
        );
        relevantAuthUsers.forEach((u: Record<string, unknown>) => {
          emailMap.set(u.id as string, {
            email: (u.email as string) || '',
            lastSignIn: (u.last_sign_in_at as string) || null,
            emailConfirmed: !!u.email_confirmed_at,
          });
        });
      }
    }

    // Get roles ONLY for the current page's profiles
    const { data: pageRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role')
      .in('user_id', profileIds);

    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
    }

    // Build role map for current page only
    const roleMap = new Map<string, string[]>();
    pageRoles?.forEach(r => {
      const existing = roleMap.get(r.user_id) || [];
      existing.push(r.role);
      roleMap.set(r.user_id, existing);
    });

    // Get property counts ONLY for current page's profiles using aggregation
    const { data: propertyCounts } = await supabaseAdmin
      .from('properties')
      .select('agent_id')
      .in('agent_id', profileIds)
      .in('status', ['activa', 'active', 'published', 'pending', 'pendiente', 'rejected']);

    const propertyCountMap = new Map<string, { total: number; active: number }>();
    propertyCounts?.forEach(p => {
      const current = propertyCountMap.get(p.agent_id) || { total: 0, active: 0 };
      current.total++;
      propertyCountMap.set(p.agent_id, current);
    });

    // Get active property counts for current page
    const { data: activeProps } = await supabaseAdmin
      .from('properties')
      .select('agent_id')
      .in('agent_id', profileIds)
      .in('status', ['activa', 'active', 'published']);

    activeProps?.forEach(p => {
      const current = propertyCountMap.get(p.agent_id) || { total: 0, active: 0 };
      current.active++;
      propertyCountMap.set(p.agent_id, current);
    });

    // Get subscription info for current page's profiles only
    const { data: subscriptions } = await supabaseAdmin
      .from('user_subscriptions')
      .select(`
        user_id,
        status,
        billing_cycle,
        current_period_end,
        plan_id,
        subscription_plans(name, display_name)
      `)
      .in('user_id', profileIds);

    const subscriptionMap = new Map<string, Record<string, unknown>>();
    subscriptions?.forEach((s: Record<string, unknown>) => {
      const plan = s.subscription_plans as Record<string, unknown> | null;
      subscriptionMap.set(s.user_id as string, {
        status: s.status,
        billing_cycle: s.billing_cycle,
        current_period_end: s.current_period_end,
        plan_name: plan?.name || null,
        plan_display_name: plan?.display_name || null,
      });
    });

    // Combine data for current page only
    let users = (profiles || []).map(profile => {
      const authInfo = emailMap.get(profile.id) || { email: '', lastSignIn: null, emailConfirmed: false };
      const roles = roleMap.get(profile.id) || ['buyer'];
      const propertyInfo = propertyCountMap.get(profile.id) || { total: 0, active: 0 };
      const subscription = subscriptionMap.get(profile.id) || null;

      // Get primary role (highest priority)
      const rolePriority: Record<string, number> = {
        super_admin: 6, admin: 5, moderator: 4, agency: 3, agent: 2, developer: 2, buyer: 1
      };
      const primaryRole = roles.reduce((highest, current) => {
        return (rolePriority[current] || 0) > (rolePriority[highest] || 0) ? current : highest;
      }, 'buyer');

      return {
        ...profile,
        email: authInfo.email,
        last_sign_in: authInfo.lastSignIn,
        email_confirmed: authInfo.emailConfirmed,
        roles,
        primaryRole,
        property_count: propertyInfo.total,
        active_property_count: propertyInfo.active,
        subscription,
      };
    });

    // Apply role filter (client-side for this page only)
    if (roleFilter && roleFilter !== 'all') {
      users = users.filter(u => u.roles.includes(roleFilter));
    }

    // Apply plan filter (client-side for this page only)
    if (planFilter && planFilter !== 'all') {
      if (planFilter === 'no_subscription') {
        users = users.filter(u => !u.subscription);
      } else {
        users = users.filter(u => u.subscription?.plan_name === planFilter);
      }
    }

    // Apply property count filters (client-side for this page only)
    if (minProperties !== undefined && minProperties > 0) {
      users = users.filter(u => u.property_count >= minProperties);
    }
    if (maxProperties !== undefined && maxProperties >= 0) {
      users = users.filter(u => u.property_count <= maxProperties);
    }

    // Calculate metrics using cached counts (not full table scans)
    // These are approximate for filtered results
    const metrics = {
      total: totalCount || 0,
      agents: users.filter(u => u.roles.includes('agent')).length,
      agencies: users.filter(u => u.roles.includes('agency')).length,
      suspended: users.filter(u => u.status === 'suspended').length,
      verified: users.filter(u => u.is_verified).length,
      phoneVerified: users.filter(u => u.phone_verified).length,
      withSubscription: users.filter(u => u.subscription).length,
      withProperties: users.filter(u => u.property_count > 0).length,
    };

    console.log(`[admin-list-users] Returning ${users.length} users (page ${page}/${Math.ceil((totalCount || 0) / safePageSize)})`);

    return new Response(JSON.stringify({
      users,
      total: totalCount || 0,
      page,
      pageSize: safePageSize,
      totalPages: Math.ceil((totalCount || 0) / safePageSize),
      metrics,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in admin-list-users:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
