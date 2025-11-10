import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationEmailRequest {
  adminEmail: string;
  adminName: string;
  notificationType: 'bypass' | 'upgrade' | 'downgrade';
  userName: string;
  planName: string;
  timestamp: string;
  isAdminChange?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
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
      console.error("Authentication error:", authError);
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const {
      adminEmail,
      adminName,
      notificationType,
      userName,
      planName,
      timestamp,
      isAdminChange,
    }: NotificationEmailRequest = await req.json();

    console.log("Sending admin notification email:", {
      adminEmail,
      notificationType,
      userName,
      planName,
    });

    // Generate email subject based on notification type
    let subject = "";
    let eventIcon = "";
    let eventColor = "";
    
    if (notificationType === 'bypass') {
      subject = isAdminChange 
        ? "⚠️ Admin Forzó Cambio de Plan"
        : "⚠️ Bypass de Cooldown Detectado";
      eventIcon = "⚠️";
      eventColor = "#f59e0b";
    } else if (notificationType === 'upgrade') {
      subject = "📈 Nuevo Upgrade de Plan";
      eventIcon = "📈";
      eventColor = "#10b981";
    } else if (notificationType === 'downgrade') {
      subject = "📉 Downgrade de Plan Detectado";
      eventIcon = "📉";
      eventColor = "#ef4444";
    }

    // Build HTML email template
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
          <div style="background-color: white; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="font-size: 48px; margin-bottom: 8px;">${eventIcon}</div>
              <h1 style="color: ${eventColor}; margin: 0; font-size: 24px;">${subject}</h1>
            </div>
            
            <div style="background-color: #f9fafb; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
              <p style="margin: 0 0 12px 0;"><strong>Hola ${adminName},</strong></p>
              <p style="margin: 0 0 8px 0;">Se ha detectado un evento importante en el sistema de suscripciones:</p>
              
              <div style="margin: 16px 0; padding: 16px; background-color: white; border-left: 4px solid ${eventColor}; border-radius: 4px;">
                <p style="margin: 0 0 8px 0;"><strong>Usuario:</strong> ${userName}</p>
                <p style="margin: 0 0 8px 0;"><strong>Plan:</strong> ${planName}</p>
                <p style="margin: 0 0 8px 0;"><strong>Tipo de evento:</strong> ${notificationType === 'bypass' ? 'Bypass de cooldown' : notificationType === 'upgrade' ? 'Upgrade de plan' : 'Downgrade de plan'}</p>
                <p style="margin: 0;"><strong>Fecha:</strong> ${new Date(timestamp).toLocaleString('es-MX', { dateStyle: 'full', timeStyle: 'short' })}</p>
                ${isAdminChange ? '<p style="margin: 8px 0 0 0; color: #f59e0b;"><strong>⚠️ Cambio forzado por administrador</strong></p>' : ''}
              </div>
            </div>
            
            <div style="margin-bottom: 24px;">
              <a href="https://kentramx.lovable.app/admin/subscription-changes" style="display: inline-block; padding: 12px 24px; background-color: #0ea5e9; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Ver Panel de Auditoría</a>
            </div>
            
            <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 24px;">
              <p style="margin: 0; font-size: 14px; color: #6b7280;">
                Puedes configurar estas notificaciones en:
                <a href="https://kentramx.lovable.app/admin/notification-settings" style="color: #0ea5e9; text-decoration: none;">Configuración de Notificaciones</a>
              </p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 24px; color: #6b7280; font-size: 12px;">
            <p>Este es un correo automático del sistema de administración de Kentra</p>
          </div>
        </body>
      </html>
    `;

    // Send email using Resend
    const emailResponse = await resend.emails.send({
      from: "Kentra Admin <notificaciones@resend.dev>",
      to: [adminEmail],
      subject: subject,
      html: html,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-admin-notification-email function:", error);
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
