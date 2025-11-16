import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  code: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { code }: VerifyRequest = await req.json();

    if (!code || code.length !== 6) {
      return new Response(
        JSON.stringify({ error: "Código inválido" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("🔍 Verifying code for user:", user.id);

    // Create admin client to access phone_verifications table
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get verification record
    const { data: verification, error: fetchError } = await supabaseAdmin
      .from("phone_verifications")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (fetchError || !verification) {
      console.error("Error fetching verification:", fetchError);
      return new Response(
        JSON.stringify({ error: "No hay código de verificación pendiente" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if blocked
    if (verification.blocked_until) {
      const blockedUntil = new Date(verification.blocked_until);
      if (blockedUntil > new Date()) {
        const minutesLeft = Math.ceil((blockedUntil.getTime() - Date.now()) / 60000);
        return new Response(
          JSON.stringify({ 
            error: `Bloqueado por intentos excesivos. Intenta en ${minutesLeft} minuto${minutesLeft !== 1 ? 's' : ''}`,
            blockedUntil: verification.blocked_until
          }),
          {
            status: 429,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    }

    // Check if code is expired
    const expiresAt = new Date(verification.expires_at);
    if (expiresAt < new Date()) {
      return new Response(
        JSON.stringify({ error: "El código ha expirado. Solicita uno nuevo" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if max attempts reached
    if (verification.attempts >= verification.max_attempts) {
      const blockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      await supabaseAdmin
        .from("phone_verifications")
        .update({ blocked_until: blockedUntil.toISOString() })
        .eq("user_id", user.id);

      return new Response(
        JSON.stringify({ 
          error: "Demasiados intentos fallidos. Bloqueado por 15 minutos",
          blockedUntil: blockedUntil.toISOString()
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Verify code using bcrypt
    const isValidCode = await bcrypt.compare(code, verification.code_hash);

    if (!isValidCode) {
      // Increment attempts counter
      const newAttempts = verification.attempts + 1;
      await supabaseAdmin
        .from("phone_verifications")
        .update({ attempts: newAttempts })
        .eq("user_id", user.id);

      const attemptsRemaining = verification.max_attempts - newAttempts;
      return new Response(
        JSON.stringify({ 
          error: "Código incorrecto",
          attemptsRemaining: Math.max(0, attemptsRemaining)
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("✅ Code verified successfully");

    // Mark phone as verified in profiles
    const { error: updateError } = await supabaseClient
      .from("profiles")
      .update({
        phone_verified: true,
        phone_verified_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Error updating profile:", updateError);
      return new Response(
        JSON.stringify({ error: "Error al actualizar verificación" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Delete verification record after successful verification
    await supabaseAdmin
      .from("phone_verifications")
      .delete()
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Error updating profile:", updateError);
      return new Response(
        JSON.stringify({ error: "Error al actualizar verificación" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Teléfono verificado exitosamente"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in verify-phone-code:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
