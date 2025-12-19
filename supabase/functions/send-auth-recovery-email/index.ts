/**
 * Edge Function: send-auth-recovery-email
 * 
 * Envía email de recuperación de contraseña usando Resend con dominio custom
 * Se llama cuando un usuario solicita restablecer su contraseña
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { 
  getRecoveryEmailHtml, 
  getRecoveryEmailText 
} from "../_shared/authEmailTemplates.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Configuración
const TOKEN_LENGTH = 64;
const RECOVERY_EXPIRY_MINUTES = 60;
const BASE_URL = "https://kentra.com.mx";
const FROM_EMAIL = "Kentra <noreply@updates.kentra.com.mx>";
const REPLY_TO = "soporte@kentra.com.mx";

/**
 * Genera un token seguro aleatorio
 */
function generateSecureToken(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Hash SHA-256 del token para almacenamiento seguro
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

interface RequestBody {
  email: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json() as RequestBody;

    if (!email) {
      console.error("❌ Missing email");
      return new Response(
        JSON.stringify({ error: "email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`📧 Processing recovery request for: ${normalizedEmail}`);

    // Crear cliente Supabase con service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Buscar usuario por email usando Admin API
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userError) {
      console.error("❌ Error fetching users:", userError);
      // No revelamos si el usuario existe o no por seguridad
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "If an account exists with this email, a recovery link will be sent" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar el usuario específico
    const user = userData.users.find(u => u.email?.toLowerCase() === normalizedEmail);

    if (!user) {
      console.log(`ℹ️ No user found for email: ${normalizedEmail}`);
      // No revelamos si el usuario existe o no por seguridad
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "If an account exists with this email, a recovery link will be sent" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obtener nombre del usuario si tiene perfil
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .single();

    // Generar token de recuperación
    const recoveryToken = generateSecureToken(TOKEN_LENGTH);
    const tokenHash = await hashToken(recoveryToken);
    
    // Calcular expiración
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + RECOVERY_EXPIRY_MINUTES);

    // Invalidar tokens anteriores del mismo tipo para este usuario
    await supabaseAdmin
      .from("auth_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("token_type", "recovery")
      .is("used_at", null);

    // Insertar nuevo token
    const { error: insertError } = await supabaseAdmin
      .from("auth_tokens")
      .insert({
        user_id: user.id,
        email: normalizedEmail,
        token_hash: tokenHash,
        token_type: "recovery",
        expires_at: expiresAt.toISOString(),
        metadata: { sent_at: new Date().toISOString() }
      });

    if (insertError) {
      console.error("❌ Error inserting token:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create recovery token" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Crear URL de recuperación
    const recoveryLink = `${BASE_URL}/auth?mode=reset&token=${recoveryToken}`;

    // Generar contenido del email
    const htmlContent = getRecoveryEmailHtml({
      userName: profile?.name || "",
      recoveryLink,
      expiresInMinutes: RECOVERY_EXPIRY_MINUTES
    });

    const textContent = getRecoveryEmailText({
      userName: profile?.name || "",
      recoveryLink,
      expiresInMinutes: RECOVERY_EXPIRY_MINUTES
    });

    // Generar ID único para anti-spam
    const entityRefId = crypto.randomUUID();

    // Enviar email con Resend
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: FROM_EMAIL,
      reply_to: REPLY_TO,
      to: [normalizedEmail],
      subject: "Recupera tu contraseña de Kentra",
      html: htmlContent,
      text: textContent,
      headers: {
        "X-Entity-Ref-ID": entityRefId,
        "List-Unsubscribe": "<https://kentra.com.mx/configuracion-notificaciones>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      tags: [
        { name: "category", value: "transactional" },
        { name: "type", value: "recovery" },
        { name: "app", value: "kentra" }
      ]
    });

    if (emailError) {
      console.error("❌ Resend error:", emailError);
      return new Response(
        JSON.stringify({ error: "Failed to send recovery email", details: emailError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Recovery email sent successfully. Resend ID: ${emailData?.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "If an account exists with this email, a recovery link will be sent"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("❌ Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
