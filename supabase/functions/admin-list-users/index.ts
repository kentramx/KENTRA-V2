import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    const offset = (page - 1) * pageSize;

    // Get all auth users for email lookup via direct SQL query
    // (Admin API listUsers() fails with "Database error finding users")
    const emailMap = new Map<string, { email: string; lastSignIn: string | null; emailConfirmed: boolean }>();
    
    const { data: authUsers, error: authUsersError } = await supabaseAdmin
      .schema('auth')
      .from('users')
      .select('id, email, email_confirmed_at, last_sign_in_at');

    if (authUsersError) {
      console.error('Error fetching auth users via SQL:', authUsersError);
    } else if (authUsers) {
      authUsers.forEach((u: any) => {
        emailMap.set(u.id, { 
          email: u.email || '', 
          lastSignIn: u.last_sign_in_at || null,
          emailConfirmed: !!u.email_confirmed_at,
        });
      });
    }

    console.log(`[admin-list-users] Loaded ${emailMap.size} auth users emails via SQL`);

    // Build query for profiles
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

    // Apply status filter
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    // Apply verified filter
    if (verifiedFilter === 'kyc_verified') {
      query = query.eq('is_verified', true);
    } else if (verifiedFilter === 'phone_verified') {
      query = query.eq('phone_verified', true);
    } else if (verifiedFilter === 'not_verified') {
      query = query.eq('is_verified', false).eq('phone_verified', false);
    }

    // Apply date filters
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo + 'T23:59:59.999Z');
    }

    // Get all profiles first (for role filtering and search)
    const { data: allProfiles, error: profilesError } = await query.order('created_at', { ascending: false });

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return new Response(JSON.stringify({ error: 'Error fetching profiles' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all user roles
    const { data: allRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role');

    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
      return new Response(JSON.stringify({ error: 'Error fetching roles' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get property counts per user
    const { data: propertyCounts, error: propError } = await supabaseAdmin
      .from('properties')
      .select('agent_id')
      .in('status', ['activa', 'active', 'published', 'pending', 'pendiente', 'rejected']);
    
    const propertyCountMap = new Map<string, { total: number; active: number }>();
    if (!propError && propertyCounts) {
      propertyCounts.forEach(p => {
        const current = propertyCountMap.get(p.agent_id) || { total: 0, active: 0 };
        current.total++;
        propertyCountMap.set(p.agent_id, current);
      });
    }

    // Get active property counts
    const { data: activeProps } = await supabaseAdmin
      .from('properties')
      .select('agent_id')
      .in('status', ['activa', 'active', 'published']);
    
    if (activeProps) {
      activeProps.forEach(p => {
        const current = propertyCountMap.get(p.agent_id) || { total: 0, active: 0 };
        current.active++;
        propertyCountMap.set(p.agent_id, current);
      });
    }

    // Get subscription info per user
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('user_subscriptions')
      .select(`
        user_id,
        status,
        billing_cycle,
        current_period_end,
        plan_id,
        subscription_plans(name, display_name)
      `);

    const subscriptionMap = new Map<string, any>();
    if (!subError && subscriptions) {
      subscriptions.forEach((s: any) => {
        const plan = s.subscription_plans;
        subscriptionMap.set(s.user_id, {
          status: s.status,
          billing_cycle: s.billing_cycle,
          current_period_end: s.current_period_end,
          plan_name: plan?.name || null,
          plan_display_name: plan?.display_name || null,
        });
      });
    }

    // Build role map (user can have multiple roles, get highest priority)
    const roleMap = new Map<string, string[]>();
    allRoles?.forEach(r => {
      const existing = roleMap.get(r.user_id) || [];
      existing.push(r.role);
      roleMap.set(r.user_id, existing);
    });

    // Combine data and apply filters
    let users = (allProfiles || []).map(profile => {
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

    // Apply search filter (on name or email)
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      users = users.filter(u => 
        u.name?.toLowerCase().includes(searchLower) ||
        u.email?.toLowerCase().includes(searchLower)
      );
    }

    // Apply role filter
    if (roleFilter && roleFilter !== 'all') {
      users = users.filter(u => u.roles.includes(roleFilter));
    }

    // Apply plan filter
    if (planFilter && planFilter !== 'all') {
      if (planFilter === 'no_subscription') {
        users = users.filter(u => !u.subscription);
      } else {
        users = users.filter(u => u.subscription?.plan_name === planFilter);
      }
    }

    // Apply property count filters
    if (minProperties !== undefined && minProperties > 0) {
      users = users.filter(u => u.property_count >= minProperties);
    }
    if (maxProperties !== undefined && maxProperties >= 0) {
      users = users.filter(u => u.property_count <= maxProperties);
    }

    // Calculate metrics
    const metrics = {
      total: users.length,
      agents: users.filter(u => u.roles.includes('agent')).length,
      agencies: users.filter(u => u.roles.includes('agency')).length,
      suspended: users.filter(u => u.status === 'suspended').length,
      verified: users.filter(u => u.is_verified).length,
      phoneVerified: users.filter(u => u.phone_verified).length,
      withSubscription: users.filter(u => u.subscription).length,
      withProperties: users.filter(u => u.property_count > 0).length,
    };

    // Apply pagination after all filters
    const filteredTotal = users.length;
    const paginatedUsers = users.slice(offset, offset + pageSize);

    console.log(`[admin-list-users] Returning ${paginatedUsers.length} users (page ${page}/${Math.ceil(filteredTotal / pageSize)})`);

    return new Response(JSON.stringify({
      users: paginatedUsers,
      total: filteredTotal,
      page,
      pageSize,
      totalPages: Math.ceil(filteredTotal / pageSize),
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
