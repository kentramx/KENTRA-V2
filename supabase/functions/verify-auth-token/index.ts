/**
 * Edge Function: verify-auth-token
 * 
 * Verifica tokens de verificación de email y recuperación de contraseña
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { maskEmail } from "../_shared/emailHelper.ts";
import {
  getPasswordChangedEmailHtml,
  getPasswordChangedEmailText
} from "../_shared/authEmailTemplates.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

import { getCorsHeaders, corsHeaders } from "../_shared/cors.ts";
import { validateCsrf } from "../_shared/csrfProtection.ts";
import { logAuditEvent, createAuditEntry } from "../_shared/auditLog.ts";

const FROM_EMAIL = "Kentra <no-reply@updates.kentra.com.mx>"; // Estandarizado con guión
const REPLY_TO = "soporte@kentra.com.mx";

// deno-lint-ignore no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>;

/**
 * Hash SHA-256 del token para comparación
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

interface VerifyVerificationRequest {
  type: "verification";
  code: string;
  email: string;
}

interface VerifyRecoveryRequest {
  type: "recovery";
  token: string;
  newPassword: string;
}

type RequestBody = VerifyVerificationRequest | VerifyRecoveryRequest;

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

  try {
    const body = await req.json() as RequestBody;

    // Crear cliente Supabase con service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    if (body.type === "verification") {
      return await handleVerification(req, supabaseAdmin, body, headers);
    } else if (body.type === "recovery") {
      return await handleRecovery(req, supabaseAdmin, body, headers);
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid token type" }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

  } catch (error: unknown) {
    console.error("❌ Unexpected error:", error);
    // SECURITY: Don't expose internal error details to clients
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Maneja la verificación de código de email
 */
async function handleVerification(
  req: Request,
  supabaseAdmin: AnySupabase,
  { code, email }: VerifyVerificationRequest,
  headers: Record<string, string>
): Promise<Response> {
  if (!code || !email) {
    return new Response(
      JSON.stringify({ error: "code and email are required" }),
      { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }

  const normalizedEmail = email.toLowerCase().trim();
  const codeHash = await hashToken(code);

  console.log(`🔍 Verifying code for email: ${maskEmail(normalizedEmail)}`);

  // Buscar token válido
  const { data: tokenData, error: tokenError } = await supabaseAdmin
    .from("auth_tokens")
    .select("*")
    .eq("email", normalizedEmail)
    .eq("token_hash", codeHash)
    .eq("token_type", "verification")
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (tokenError || !tokenData) {
    console.log("❌ Invalid or expired verification code");
    return new Response(
      JSON.stringify({ error: "Código inválido o expirado" }),
      { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }

  // Marcar token como usado
  await supabaseAdmin
    .from("auth_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", tokenData.id);

  // Marcar email como verificado en auth.users
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    tokenData.user_id,
    { email_confirm: true }
  );

  if (updateError) {
    console.error("❌ Error confirming email:", updateError);
    return new Response(
      JSON.stringify({ error: "Error al verificar email" }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }

  console.log(`✅ Email verified successfully for user: ${tokenData.user_id}`);

  // SECURITY: Audit log for email verification
  await logAuditEvent(createAuditEntry(req, 'auth.email_verification_complete', {
    userId: tokenData.user_id,
    email: normalizedEmail,
    success: true,
  }), supabaseAdmin);

  return new Response(
    JSON.stringify({
      success: true,
      message: "Email verificado correctamente",
      userId: tokenData.user_id
    }),
    { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
  );
}

/**
 * Maneja la recuperación de contraseña
 */
async function handleRecovery(
  req: Request,
  supabaseAdmin: AnySupabase,
  { token, newPassword }: VerifyRecoveryRequest,
  headers: Record<string, string>
): Promise<Response> {
  if (!token || !newPassword) {
    return new Response(
      JSON.stringify({ error: "token and newPassword are required" }),
      { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }

  // Validar contraseña - DEBE coincidir con frontend (12 chars, mayúscula, minúscula, número, especial)
  const passwordErrors: string[] = [];
  if (newPassword.length < 12) {
    passwordErrors.push("al menos 12 caracteres");
  }
  if (!/[A-Z]/.test(newPassword)) {
    passwordErrors.push("una letra mayúscula");
  }
  if (!/[a-z]/.test(newPassword)) {
    passwordErrors.push("una letra minúscula");
  }
  if (!/[0-9]/.test(newPassword)) {
    passwordErrors.push("un número");
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
    passwordErrors.push("un carácter especial (!@#$%^&*...)");
  }

  if (passwordErrors.length > 0) {
    return new Response(
      JSON.stringify({
        error: `La contraseña debe contener: ${passwordErrors.join(", ")}`
      }),
      { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }

  const tokenHash = await hashToken(token);

  console.log(`🔍 Verifying recovery token`);

  // Buscar token válido
  const { data: tokenData, error: tokenError } = await supabaseAdmin
    .from("auth_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .eq("token_type", "recovery")
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (tokenError || !tokenData) {
    console.log("❌ Invalid or expired recovery token");
    return new Response(
      JSON.stringify({ error: "Enlace inválido o expirado. Solicita un nuevo enlace de recuperación." }),
      { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }

  // Marcar token como usado
  await supabaseAdmin
    .from("auth_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", tokenData.id);

  // Actualizar contraseña
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    tokenData.user_id,
    { password: newPassword }
  );

  if (updateError) {
    console.error("❌ Error updating password:", updateError);
    return new Response(
      JSON.stringify({ error: "Error al actualizar contraseña" }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }

  // Invalidar todas las sesiones del usuario por seguridad
  try {
    await supabaseAdmin.auth.admin.signOut(tokenData.user_id, 'global');
    console.log(`🔒 All sessions invalidated for user: ${tokenData.user_id}`);
  } catch (signOutError) {
    console.warn("⚠️ Could not invalidate sessions:", signOutError);
    // Continuar aunque falle - la contraseña ya fue cambiada
  }

  console.log(`✅ Password updated successfully for user: ${tokenData.user_id}`);

  // Obtener nombre del usuario para el email de confirmación
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("name")
    .eq("id", tokenData.user_id)
    .single();

  // Enviar email de confirmación de cambio de contraseña
  try {
    const htmlContent = getPasswordChangedEmailHtml({
      userName: profile?.name || ""
    });

    const textContent = getPasswordChangedEmailText({
      userName: profile?.name || ""
    });

    await resend.emails.send({
      from: FROM_EMAIL,
      reply_to: REPLY_TO,
      to: [tokenData.email],
      subject: "Tu contraseña de Kentra ha sido actualizada",
      html: htmlContent,
      text: textContent,
      headers: {
        "X-Entity-Ref-ID": crypto.randomUUID(),
      },
      tags: [
        { name: "category", value: "transactional" },
        { name: "type", value: "password_changed" },
        { name: "app", value: "kentra" }
      ]
    });

    console.log("✅ Password change confirmation email sent");
  } catch (emailError) {
    // No fallar si el email de confirmación no se envía
    console.error("⚠️ Error sending password change confirmation:", emailError);
  }

  // SECURITY: Audit log for password change
  await logAuditEvent(createAuditEntry(req, 'auth.password_reset_complete', {
    userId: tokenData.user_id,
    email: tokenData.email,
    success: true,
    metadata: { method: 'recovery_token' }
  }), supabaseAdmin);

  return new Response(
    JSON.stringify({
      success: true,
      message: "Contraseña actualizada correctamente"
    }),
    { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
  );
}
