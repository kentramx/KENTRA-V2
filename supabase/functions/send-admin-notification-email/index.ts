import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";
import { sendEmail, getAntiSpamFooter, EMAIL_CONFIG } from '../_shared/emailHelper.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error("Authentication error:", authError);
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
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

    console.log("Sending admin notification email:", { adminEmail, notificationType, userName, planName });

    let subject = "";
    let eventIcon = "";
    let eventColor = "";
    
    if (notificationType === 'bypass') {
      subject = isAdminChange ? "⚠️ Admin Forzó Cambio de Plan" : "⚠️ Bypass de Cooldown Detectado";
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

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="padding: 32px; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 8px;">${eventIcon}</div>
      <h1 style="color: ${eventColor}; margin: 0; font-size: 24px;">${subject}</h1>
    </div>
    
    <div style="padding: 0 32px 32px;">
      <p style="color: #374151;"><strong>Hola ${adminName},</strong></p>
      <p style="color: #374151;">Se ha detectado un evento importante en el sistema de suscripciones:</p>
      
      <div style="margin: 20px 0; padding: 20px; background-color: #f9fafb; border-left: 4px solid ${eventColor}; border-radius: 4px;">
        <p style="margin: 0 0 8px 0;"><strong>Usuario:</strong> ${userName}</p>
        <p style="margin: 0 0 8px 0;"><strong>Plan:</strong> ${planName}</p>
        <p style="margin: 0 0 8px 0;"><strong>Tipo de evento:</strong> ${notificationType === 'bypass' ? 'Bypass de cooldown' : notificationType === 'upgrade' ? 'Upgrade de plan' : 'Downgrade de plan'}</p>
        <p style="margin: 0;"><strong>Fecha:</strong> ${new Date(timestamp).toLocaleString('es-MX', { dateStyle: 'full', timeStyle: 'short' })}</p>
        ${isAdminChange ? '<p style="margin: 8px 0 0 0; color: #f59e0b;"><strong>⚠️ Cambio forzado por administrador</strong></p>' : ''}
      </div>
      
      <div style="text-align: center; margin: 24px 0;">
        <a href="${EMAIL_CONFIG.baseUrl}/admin/subscription-changes" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Ver Panel de Auditoría</a>
      </div>
      
      <p style="margin-top: 24px; font-size: 14px; color: #6b7280;">
        Puedes configurar estas notificaciones en:
        <a href="${EMAIL_CONFIG.baseUrl}/admin/notification-settings" style="color: #6366f1;">Configuración de Notificaciones</a>
      </p>
    </div>
    ${getAntiSpamFooter()}
  </div>
</body>
</html>
    `;

    const result = await sendEmail({
      to: adminEmail,
      subject,
      htmlContent: html,
      category: 'transactional',
      fromName: 'Kentra Admin',
      tags: [
        { name: 'notification_type', value: 'admin_alert' },
        { name: 'event_type', value: notificationType },
      ],
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log("Email sent successfully:", result.data);

    return new Response(JSON.stringify(result.data), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-admin-notification-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
