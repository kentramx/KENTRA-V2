/**
 * Edge Function: send-auth-verification-email
 *
 * Envía email de verificación de cuenta usando Resend con dominio custom
 * Se llama después del registro para enviar código de verificación
 *
 * SEGURIDAD: Verifica que el usuario autenticado coincida con el userId solicitado
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { maskEmail } from "../_shared/emailHelper.ts";
import {
  getVerificationEmailHtml,
  getVerificationEmailText
} from "../_shared/authEmailTemplates.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, getClientIP, rateLimitedResponse, RateLimitConfig } from "../_shared/rateLimit.ts";
import { validateCsrf } from "../_shared/csrfProtection.ts";
import { logAuditEvent, createAuditEntry } from "../_shared/auditLog.ts";

// SECURITY: Rate limit to prevent email bombing - 3 emails per 10 minutes per IP
const emailRateLimit: RateLimitConfig = {
  maxRequests: 3,
  windowMs: 10 * 60 * 1000, // 10 minutes
  keyPrefix: 'email-verification',
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Configuración
const VERIFICATION_CODE_LENGTH = 6;
const VERIFICATION_EXPIRY_HOURS = 24;
const FROM_EMAIL = "Kentra <no-reply@updates.kentra.com.mx>";
const REPLY_TO = "soporte@kentra.com.mx";

/**
 * Genera un código numérico aleatorio de N dígitos usando crypto seguro
 */
function generateVerificationCode(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => (byte % 10).toString()).join("");
}

/**
 * Hash SHA-256 del código para almacenamiento seguro
 */
async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

interface RequestBody {
  userId: string;
  email: string;
  userName?: string;
}

serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const headers = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  // SECURITY: CSRF protection for state-changing operation
  const isDev = Deno.env.get('ENVIRONMENT') === 'development';
  const csrfResult = validateCsrf(req, { requireXRequestedWith: false, allowDev: isDev });
  if (!csrfResult.valid) {
    console.warn(`CSRF validation failed: ${csrfResult.error}`);
    return new Response(
      JSON.stringify({ error: "Invalid request origin" }),
      { status: 403, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }

  // SECURITY: Rate limiting to prevent email bombing
  const clientIP = getClientIP(req);
  const rateLimitResult = checkRateLimit(clientIP, emailRateLimit);
  if (!rateLimitResult.allowed) {
    console.warn(`Rate limit exceeded for email verification from IP: ${clientIP}`);
    return rateLimitedResponse(rateLimitResult, headers);
  }

  try {
    const { userId, email, userName } = await req.json() as RequestBody;

    if (!userId || !email) {
      console.error("❌ Missing required fields:", { userId, email });
      return new Response(
        JSON.stringify({ error: "userId and email are required" }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // SEGURIDAD: Verificar autenticación y ownership
    const authHeader = req.headers.get("Authorization");

    // Crear cliente Supabase con service role para operaciones admin
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Si hay Authorization header, verificar que el usuario coincide
    if (authHeader) {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        {
          global: {
            headers: { Authorization: authHeader },
          },
        }
      );

      const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

      if (!userError && user) {
        // Usuario autenticado - verificar que el userId coincide
        if (user.id !== userId) {
          console.warn(`🚫 User ${user.id} attempted to send verification for ${userId}`);
          return new Response(
            JSON.stringify({ error: "No autorizado" }),
            { status: 403, headers: { ...headers, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Verificar que el userId existe en la base de datos
    const { data: targetUser, error: targetUserError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (targetUserError || !targetUser?.user) {
      console.warn(`🚫 Attempted to send verification to non-existent user: ${userId}`);
      // No revelar si el usuario existe
      return new Response(
        JSON.stringify({ success: true, message: "If the account exists, a verification email will be sent" }),
        { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // Verificar que el email coincide con el del usuario
    if (targetUser.user.email?.toLowerCase() !== email.toLowerCase()) {
      console.warn(`🚫 Email mismatch for user ${userId}`);
      return new Response(
        JSON.stringify({ success: true, message: "If the account exists, a verification email will be sent" }),
        { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    console.log(`📧 Sending verification email to: ${maskEmail(email)}`);

    // Rate limiting check (5 attempts per hour, 24-hour block)
    const { data: rateLimitData, error: rateLimitError } = await supabaseAdmin
      .rpc('check_verification_rate_limit', {
        p_email: email.toLowerCase(),
        p_type: 'email',
        p_max_attempts: 5,
        p_window_hours: 1,
        p_block_hours: 24
      });

    if (rateLimitError) {
      console.warn("⚠️ Rate limit check failed, proceeding:", rateLimitError);
    } else if (rateLimitData && rateLimitData[0] && !rateLimitData[0].allowed) {
      console.log(`🚫 Rate limit exceeded for: ${maskEmail(email)}`);
      return new Response(
        JSON.stringify({
          error: "Demasiados intentos. Por favor espera antes de solicitar otro código.",
          blocked_until: rateLimitData[0].blocked_until
        }),
        { status: 429, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // Generar código de verificación
    const verificationCode = generateVerificationCode(VERIFICATION_CODE_LENGTH);
    const codeHash = await hashCode(verificationCode);

    // Calcular expiración
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + VERIFICATION_EXPIRY_HOURS);

    // Invalidar tokens anteriores del mismo tipo para este usuario
    await supabaseAdmin
      .from("auth_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("token_type", "verification")
      .is("used_at", null);

    // Insertar nuevo token
    const { error: insertError } = await supabaseAdmin
      .from("auth_tokens")
      .insert({
        user_id: userId,
        email: email.toLowerCase(),
        token_hash: codeHash,
        token_type: "verification",
        expires_at: expiresAt.toISOString(),
        metadata: { sent_at: new Date().toISOString() }
      });

    if (insertError) {
      console.error("❌ Error inserting token:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create verification token" }),
        { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // Generar contenido del email
    const htmlContent = getVerificationEmailHtml({
      userName: userName || "",
      verificationCode,
      expiresInHours: VERIFICATION_EXPIRY_HOURS
    });

    const textContent = getVerificationEmailText({
      userName: userName || "",
      verificationCode,
      expiresInHours: VERIFICATION_EXPIRY_HOURS
    });

    // Generar ID único para anti-spam
    const entityRefId = crypto.randomUUID();

    // Enviar email con Resend
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: FROM_EMAIL,
      reply_to: REPLY_TO,
      to: [email],
      subject: `${verificationCode} es tu código de verificación de Kentra`,
      html: htmlContent,
      text: textContent,
      headers: {
        "X-Entity-Ref-ID": entityRefId,
        "List-Unsubscribe": "<https://kentra.com.mx/configuracion-notificaciones>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      tags: [
        { name: "category", value: "transactional" },
        { name: "type", value: "verification" },
        { name: "app", value: "kentra" }
      ]
    });

    if (emailError) {
      console.error("❌ Resend error:", emailError);
      return new Response(
        JSON.stringify({ error: "Failed to send verification email", details: emailError.message }),
        { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Verification email sent successfully. Resend ID: ${emailData?.id}`);

    // SECURITY: Audit log for verification email sent
    await logAuditEvent(createAuditEntry(req, 'auth.email_verification_sent', {
      userId,
      email,
      success: true,
      metadata: { resend_id: emailData?.id }
    }), supabaseAdmin);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Verification email sent",
        expiresAt: expiresAt.toISOString()
      }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("❌ Unexpected error:", error);
    // SECURITY: Don't expose internal error details to clients
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});
