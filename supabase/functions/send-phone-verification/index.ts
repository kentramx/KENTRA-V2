import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerificationRequest {
  phoneNumber: string;
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

    const { phoneNumber }: VerificationRequest = await req.json();

    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ error: "Número de teléfono requerido" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("📱 Sending verification code to:", phoneNumber);

    // Create admin client for phone_verifications table access
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if user has existing verification record
    const { data: existingVerification } = await supabaseAdmin
      .from("phone_verifications")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Check if blocked
    if (existingVerification?.blocked_until) {
      const blockedUntil = new Date(existingVerification.blocked_until);
      if (blockedUntil > new Date()) {
        const minutesLeft = Math.ceil((blockedUntil.getTime() - Date.now()) / 60000);
        return new Response(
          JSON.stringify({ 
            error: `Bloqueado por intentos excesivos. Intenta en ${minutesLeft} minuto${minutesLeft !== 1 ? 's' : ''}`,
            blockedUntil: existingVerification.blocked_until
          }),
          {
            status: 429,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    }

    // Check hourly rate limit (3 codes per hour)
    if (existingVerification?.last_request_at) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const lastRequest = new Date(existingVerification.last_request_at);
      
      if (lastRequest > hourAgo && existingVerification.request_count_hour >= 3) {
        const retryAfter = new Date(lastRequest.getTime() + 60 * 60 * 1000);
        const minutesLeft = Math.ceil((retryAfter.getTime() - Date.now()) / 60000);
        return new Response(
          JSON.stringify({ 
            error: `Límite de 3 códigos por hora alcanzado. Intenta en ${minutesLeft} minuto${minutesLeft !== 1 ? 's' : ''}`,
            retryAfter: retryAfter.toISOString()
          }),
          {
            status: 429,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    }

    // Generate 6-digit code and hash it
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10);
    const codeHash = await bcrypt.hash(verificationCode, salt);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    console.log("🔑 Generated verification code (will be hashed)");

    // Calculate new request count
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const lastRequest = existingVerification?.last_request_at ? new Date(existingVerification.last_request_at) : null;
    const newRequestCount = (lastRequest && lastRequest > hourAgo) 
      ? (existingVerification.request_count_hour + 1) 
      : 1;

    // Save hashed code to phone_verifications table
    const { error: updateError } = await supabaseAdmin
      .from("phone_verifications")
      .upsert({
        user_id: user.id,
        phone_number: phoneNumber,
        code_hash: codeHash,
        attempts: 0, // Reset attempts with new code
        blocked_until: null, // Clear any blocks
        last_request_at: new Date().toISOString(),
        request_count_hour: newRequestCount,
        expires_at: expiresAt.toISOString(),
      });

    if (updateError) {
      console.error("Error saving verification code:", updateError);
      return new Response(
        JSON.stringify({ error: "Error al guardar código de verificación" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Update phone number in profiles (but not the code)
    await supabaseClient
      .from("profiles")
      .update({
        phone: phoneNumber,
        phone_verified: false,
      })
      .eq("id", user.id);

    // TODO: Send SMS using Twilio
    // For now, we'll just log the code (DEVELOPMENT ONLY)
    console.log("🔐 Verification code:", verificationCode);
    console.log("⏰ Expires at:", expiresAt);

    // Check if Twilio credentials are configured
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
      // Send actual SMS via Twilio
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
      
      const params = new URLSearchParams();
      params.append("To", phoneNumber);
      params.append("From", twilioPhoneNumber);
      params.append("Body", `Tu código de verificación de Kentra es: ${verificationCode}. Expira en 10 minutos.`);

      const twilioResponse = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          "Authorization": "Basic " + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      });

      if (!twilioResponse.ok) {
        const error = await twilioResponse.json();
        console.error("Twilio error:", error);
        return new Response(
          JSON.stringify({ 
            error: "Error al enviar SMS",
            details: error 
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      console.log("✅ SMS sent via Twilio successfully");
    } else {
      console.warn("⚠️ Twilio not configured - code only saved to database");
      // In development, return the code (REMOVE IN PRODUCTION)
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "Código de verificación generado (Twilio no configurado)",
          // ONLY FOR DEVELOPMENT:
          devCode: verificationCode
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Código de verificación enviado por SMS"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-phone-verification:", error);
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
