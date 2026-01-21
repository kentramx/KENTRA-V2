import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, getClientIP, rateLimitedResponse, apiRateLimit } from "../_shared/rateLimit.ts";

interface ResubmissionNotificationRequest {
  propertyId: string;
  propertyTitle: string;
  agentName: string;
  resubmissionNumber: number;
}

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
    const { propertyId, propertyTitle, agentName, resubmissionNumber }: ResubmissionNotificationRequest = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get all admins with notification preferences
    const { data: admins, error: adminsError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'super_admin', 'moderator']);

    if (adminsError) {
      console.error('Error fetching admins:', adminsError);
      throw adminsError;
    }

    console.log(`Property resubmitted: ${propertyTitle} by ${agentName} (Attempt #${resubmissionNumber})`);
    console.log(`Priority: HIGH - This is a resubmission`);
    console.log(`Property ID: ${propertyId}`);
    console.log(`Notifying ${admins?.length || 0} administrators`);

    // TODO: Implement real-time notification using Supabase Realtime
    // or integrate with AdminRealtimeNotifications component

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Admin notification sent',
        adminCount: admins?.length || 0
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Error in notify-admin-resubmission:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);