import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, getClientIP, rateLimitedResponse, apiRateLimit } from "../_shared/rateLimit.ts";

const handler = async (req: Request): Promise<Response> => {
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
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Initialize Supabase client with service role (can access auth.users)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar que quien ejecuta sea super_admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verificar que sea super_admin
    const { data: isSuperAdmin, error: roleError } = await supabase.rpc('is_super_admin', {
      _user_id: caller.id
    });

    if (roleError || !isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: 'Only super admins can search users by email' }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Buscar usuario por email usando admin API
    const { data: users, error: searchError } = await supabase.auth.admin.listUsers();

    if (searchError) throw searchError;

    const foundUser = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!foundUser) {
      return new Response(
        JSON.stringify({ error: 'User not found', found: false }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Obtener nombre del perfil
    const { data: profileData } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', foundUser.id)
      .single();

    return new Response(
      JSON.stringify({
        found: true,
        user: {
          id: foundUser.id,
          email: foundUser.email,
          name: profileData?.name || 'Usuario',
        }
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("❌ Error in get-user-by-email:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
