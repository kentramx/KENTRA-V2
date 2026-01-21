/**
 * Edge Function: send-auth-recovery-email
 * 
 * Envía email de recuperación de contraseña usando Resend con dominio custom
 * Se llama cuando un usuario solicita restablecer su contraseña
 * 
 * DIAGNÓSTICO: Incluye headers y logging para verificar origen del email
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

// Configuración - ESTANDARIZADO
const TOKEN_LENGTH = 64;
const RECOVERY_EXPIRY_MINUTES = 60;
const BASE_URL = "https://kentra.com.mx";
const FROM_EMAIL = "Kentra <no-reply@updates.kentra.com.mx>"; // Estandarizado con guión
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

    // Rate limiting check (3 attempts per hour, 24-hour block)
    const { data: rateLimitData, error: rateLimitError } = await supabaseAdmin
      .rpc('check_verification_rate_limit', {
        p_email: normalizedEmail,
        p_type: 'password_reset',
        p_max_attempts: 3,
        p_window_hours: 1,
        p_block_hours: 24
      });

    if (rateLimitError) {
      console.warn("⚠️ Rate limit check failed, proceeding:", rateLimitError);
    } else if (rateLimitData && rateLimitData[0] && !rateLimitData[0].allowed) {
      console.log(`🚫 Rate limit exceeded for password reset: ${normalizedEmail}`);
      // Still return success to prevent email enumeration
      return new Response(
        JSON.stringify({
          success: true,
          message: "If an account exists with this email, a recovery link will be sent"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar usuario por email directamente en auth.users via SQL
    let userId: string | null = null;
    let userName: string | null = null;

    // Usar la función SQL personalizada para buscar el usuario
    const { data: userResult, error: userError } = await supabaseAdmin
      .rpc("get_user_id_by_email", { user_email: normalizedEmail });

    if (userError) {
      console.log("RPC error (may not exist):", userError.message);
      
      // Fallback: buscar en profiles si tiene el email relacionado
      // Como no tenemos acceso directo, usamos el approach de verificar si existe un token previo
      const { data: existingToken } = await supabaseAdmin
        .from("auth_tokens")
        .select("user_id")
        .eq("email", normalizedEmail)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (existingToken?.user_id) {
        userId = existingToken.user_id;
        console.log(`✅ Found user via previous token: ${userId}`);
      }
    } else if (userResult) {
      userId = userResult;
      console.log(`✅ Found user via RPC: ${userId}`);
    }

    if (!userId) {
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

    // Obtener nombre del usuario desde profiles
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("name")
      .eq("id", userId)
      .single();
    
    userName = profile?.name || null;

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
      .eq("user_id", userId)
      .eq("token_type", "recovery")
      .is("used_at", null);

    // Insertar nuevo token
    const { error: insertError } = await supabaseAdmin
      .from("auth_tokens")
      .insert({
        user_id: userId,
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
      userName: userName || "",
      recoveryLink,
      expiresInMinutes: RECOVERY_EXPIRY_MINUTES
    });

    const textContent = getRecoveryEmailText({
      userName: userName || "",
      recoveryLink,
      expiresInMinutes: RECOVERY_EXPIRY_MINUTES
    });

    // Generar ID único para anti-spam
    const entityRefId = crypto.randomUUID();

    // 🔍 DIAGNÓSTICO: Log del remitente ANTES de enviar
    console.log(`📧 [DIAGNÓSTICO] FROM_EMAIL configurado: "${FROM_EMAIL}"`);
    console.log(`📧 [DIAGNÓSTICO] Enviando a: ${normalizedEmail}`);
    console.log(`📧 [DIAGNÓSTICO] Entity-Ref-ID: ${entityRefId}`);

    // Enviar email con Resend - CON HEADER DE DIAGNÓSTICO
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: FROM_EMAIL,
      reply_to: REPLY_TO,
      to: [normalizedEmail],
      subject: "Recupera tu contraseña de Kentra",
      html: htmlContent,
      text: textContent,
      headers: {
        "X-Entity-Ref-ID": entityRefId,
        "X-Kentra-Mailer": "resend-custom-recovery", // Header de diagnóstico
        "X-Kentra-From": FROM_EMAIL, // Confirmar el from en headers
        "List-Unsubscribe": "<https://kentra.com.mx/configuracion-notificaciones>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      tags: [
        { name: "category", value: "transactional" },
        { name: "type", value: "recovery" },
        { name: "app", value: "kentra" },
        { name: "mailer", value: "edge-function" } // Tag de diagnóstico
      ]
    });

    if (emailError) {
      console.error("❌ Resend error:", emailError);
      console.error("❌ [DIAGNÓSTICO] Error details:", JSON.stringify(emailError, null, 2));
      return new Response(
        JSON.stringify({ error: "Failed to send recovery email", details: emailError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 🔍 DIAGNÓSTICO: Verificar qué registró Resend
    console.log(`✅ Recovery email sent. Resend ID: ${emailData?.id}`);
    console.log(`📧 [DIAGNÓSTICO] Resend response data:`, JSON.stringify(emailData, null, 2));

    // Intentar obtener detalles del email enviado para verificar el "from" real
    if (emailData?.id) {
      try {
        const emailDetails = await resend.emails.get(emailData.id);
        console.log(`📧 [DIAGNÓSTICO] Email registrado en Resend:`);
        console.log(`   - ID: ${emailDetails?.data?.id}`);
        console.log(`   - From: ${emailDetails?.data?.from}`);
        console.log(`   - To: ${JSON.stringify(emailDetails?.data?.to)}`);
        console.log(`   - Subject: ${emailDetails?.data?.subject}`);
      } catch (getError) {
        console.log(`⚠️ [DIAGNÓSTICO] No se pudo obtener detalles del email:`, getError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "If an account exists with this email, a recovery link will be sent",
        // Solo para diagnóstico - remover en producción
        _debug: {
          resendId: emailData?.id,
          fromUsed: FROM_EMAIL,
          mailerHeader: "resend-custom-recovery"
        }
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