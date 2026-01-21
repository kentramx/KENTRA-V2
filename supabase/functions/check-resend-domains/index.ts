/**
 * Edge Function: check-resend-domains
 * 
 * Función de DIAGNÓSTICO para verificar qué dominios están asociados
 * al RESEND_API_KEY configurado en los secrets.
 * 
 * Esto nos dice si el API key pertenece a la cuenta correcta.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, getClientIP, rateLimitedResponse, apiRateLimit } from "../_shared/rateLimit.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting for API operations
  const clientIP = getClientIP(req);
  const rateResult = checkRateLimit(clientIP, apiRateLimit);
  if (!rateResult.allowed) {
    return rateLimitedResponse(rateResult, corsHeaders);
  }

  console.log("🔍 [check-resend-domains] Checking Resend API key configuration...");

  try {
    // Verificar si hay API key configurada
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      console.error("❌ RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ 
          error: "RESEND_API_KEY not configured",
          hasApiKey: false 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mostrar solo los primeros y últimos caracteres del API key (seguro)
    const maskedKey = `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`;
    console.log(`📧 API Key (masked): ${maskedKey}`);

    // Obtener lista de dominios verificados
    console.log("📧 Fetching verified domains from Resend...");
    const { data: domains, error: domainsError } = await resend.domains.list();

    if (domainsError) {
      console.error("❌ Error fetching domains:", domainsError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to fetch domains",
          details: domainsError.message,
          hasApiKey: true,
          maskedKey
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Analizar dominios - Resend devuelve array directamente
    const domainList = Array.isArray(domains) ? domains : (domains as any)?.data || [];
    console.log(`📧 Found ${domainList.length} domain(s) in Resend account:`);
    
    const domainInfo = domainList.map((domain: any) => {
      console.log(`   - ${domain.name} (status: ${domain.status}, region: ${domain.region})`);
      return {
        name: domain.name,
        status: domain.status,
        region: domain.region,
        createdAt: domain.created_at
      };
    });

    // Verificar si updates.kentra.com.mx está en la lista
    const hasKentraDomain = domainList.some((d: any) => 
      d.name === "updates.kentra.com.mx" || d.name === "kentra.com.mx"
    );

    console.log(`📧 Has kentra domain verified: ${hasKentraDomain}`);

    // Obtener info de API keys (si está disponible)
    let apiKeysInfo: any[] | null = null;
    try {
      const { data: apiKeys } = await resend.apiKeys.list();
      const keysList = Array.isArray(apiKeys) ? apiKeys : (apiKeys as any)?.data || [];
      if (keysList.length > 0) {
        apiKeysInfo = keysList.map((key: any) => ({
          id: key.id,
          name: key.name,
          createdAt: key.created_at
        }));
        console.log(`📧 Found ${apiKeysInfo?.length || 0} API key(s) in account`);
      }
    } catch (e) {
      console.log("⚠️ Could not list API keys (may require higher permissions)");
    }
    return new Response(
      JSON.stringify({ 
        success: true,
        hasApiKey: true,
        maskedKey,
        domains: domainInfo,
        totalDomains: domainList.length,
        hasKentraDomainVerified: hasKentraDomain,
        apiKeys: apiKeysInfo,
        recommendation: hasKentraDomain 
          ? "✅ El dominio de Kentra está verificado en esta cuenta de Resend"
          : "⚠️ El dominio updates.kentra.com.mx NO está verificado en esta cuenta. El API key puede pertenecer a otra cuenta."
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
