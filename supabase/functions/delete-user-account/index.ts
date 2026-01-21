/**
 * Edge Function: delete-user-account
 *
 * Elimina completamente la cuenta de un usuario autenticado
 * SEGURIDAD: Solo el propio usuario puede eliminar su cuenta
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

// Rate limiting: máximo 3 intentos por hora por IP
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hora

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count++;
  return true;
}

serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const headers = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  // Rate limiting check
  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("cf-connecting-ip")
    || "unknown";

  if (!checkRateLimit(clientIP)) {
    console.warn(`🚫 Rate limit exceeded for delete-user-account from IP: ${clientIP.slice(0, 8)}...`);
    return new Response(
      JSON.stringify({ error: "Demasiados intentos. Intenta de nuevo más tarde." }),
      { status: 429, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }

  try {
    // Verificar que hay Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // Create a Supabase client with the user's JWT token
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get the user from the JWT token - CRITICAL: this validates ownership
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error("Error getting user:", userError);
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: The user can ONLY delete their OWN account
    // The user.id comes from the validated JWT, so this is secure
    const userIdToDelete = user.id;

    console.log(`🗑️ Deleting account for user: ${userIdToDelete}`);

    // Create admin client for user deletion
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // First, delete all user-related data
    // The database has CASCADE delete configured for most foreign keys,
    // but we'll explicitly delete critical data to ensure cleanup

    // Delete user's properties (this will cascade to images, views, etc.)
    const { error: propertiesError } = await supabaseAdmin
      .from("properties")
      .delete()
      .eq("agent_id", userIdToDelete);

    if (propertiesError) {
      console.error("Error deleting properties:", propertiesError);
      // Continue anyway, as CASCADE should handle this
    }

    // Delete user's profile
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", userIdToDelete);

    if (profileError) {
      console.error("Error deleting profile:", profileError);
      // Continue anyway
    }

    // Delete user's subscription
    const { error: subscriptionError } = await supabaseAdmin
      .from("user_subscriptions")
      .delete()
      .eq("user_id", userIdToDelete);

    if (subscriptionError) {
      console.error("Error deleting subscription:", subscriptionError);
      // Continue anyway
    }

    // Delete user's roles
    const { error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userIdToDelete);

    if (rolesError) {
      console.error("Error deleting roles:", rolesError);
      // Continue anyway
    }

    // Delete auth tokens
    const { error: tokensError } = await supabaseAdmin
      .from("auth_tokens")
      .delete()
      .eq("user_id", userIdToDelete);

    if (tokensError) {
      console.error("Error deleting auth tokens:", tokensError);
    }

    // Finally, delete the user from auth.users
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
      userIdToDelete
    );

    if (deleteError) {
      console.error("Error deleting user from auth:", deleteError);
      return new Response(
        JSON.stringify({
          error: "Error al eliminar la cuenta",
          details: deleteError.message
        }),
        { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Account successfully deleted for user: ${userIdToDelete}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Cuenta eliminada exitosamente"
      }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in delete-user-account function:", error);
    return new Response(
      JSON.stringify({
        error: "Error al procesar la solicitud",
        details: error.message
      }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});
