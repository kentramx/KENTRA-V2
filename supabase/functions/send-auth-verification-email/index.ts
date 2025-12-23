/**
 * Edge Function: send-auth-verification-email
 * 
 * Envía email de verificación de cuenta usando Resend con dominio custom
 * Se llama después del registro para enviar código de verificación
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { 
  getVerificationEmailHtml, 
  getVerificationEmailText 
} from "../_shared/authEmailTemplates.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Configuración
const VERIFICATION_CODE_LENGTH = 6;
const VERIFICATION_EXPIRY_HOURS = 24;
const FROM_EMAIL = "Kentra <no-reply@updates.kentra.com.mx>"; // Estandarizado con guión
const REPLY_TO = "soporte@kentra.com.mx";

/**
 * Genera un código numérico aleatorio de N dígitos
 */
function generateVerificationCode(length: number): string {
  const digits = "0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  return code;
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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, email, userName } = await req.json() as RequestBody;

    if (!userId || !email) {
      console.error("❌ Missing required fields:", { userId, email });
      return new Response(
        JSON.stringify({ error: "userId and email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📧 Sending verification email to: ${email}`);

    // Crear cliente Supabase con service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

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
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Verification email sent successfully. Resend ID: ${emailData?.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Verification email sent",
        expiresAt: expiresAt.toISOString()
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
