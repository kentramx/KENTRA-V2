import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { sendEmail, getAntiSpamFooter, EMAIL_CONFIG } from '../_shared/emailHelper.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  agentEmail?: string;
  agentId?: string;
  agentName: string;
  propertyTitle: string;
  action: 'approved' | 'rejected';
  rejectionReason?: {
    label: string;
    details?: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("📧 Received moderation notification request");
    const { agentEmail, agentId, agentName, propertyTitle, action, rejectionReason }: NotificationRequest = await req.json();

    let resolvedEmail = agentEmail;

    // If no email provided but agentId exists, resolve email from auth
    if (!resolvedEmail && agentId) {
      console.log(`🔍 Resolving email for agentId: ${agentId}`);
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error("Missing Supabase credentials");
      }

      const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${agentId}`, {
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey,
        },
      });

      if (!response.ok) {
        console.error('❌ Failed to fetch user:', await response.text());
        throw new Error("Could not resolve agent email");
      }

      const userData = await response.json();
      resolvedEmail = userData.email;
      
      if (!resolvedEmail) {
        throw new Error("User has no email");
      }
      
      console.log(`✅ Resolved email: ${resolvedEmail}`);
    }

    if (!resolvedEmail) {
      throw new Error("Agent email is required");
    }
    
    console.log(`📤 Sending ${action} notification to ${resolvedEmail} for property: ${propertyTitle}`);

    let subject = '';
    let html = '';

    if (action === 'approved') {
      subject = `✅ Tu propiedad "${propertyTitle}" ha sido aprobada`;
      
      html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">✅ Propiedad Aprobada</h1>
    </div>
    <div style="padding: 30px;">
      <h2 style="color: #10b981; margin: 0 0 16px 0; font-size: 20px;">¡Buenas noticias!</h2>
      <p style="color: #374151; font-size: 16px;">Hola <strong>${agentName}</strong>,</p>
      <p style="color: #374151; font-size: 16px;">Tu propiedad <strong>"${propertyTitle}"</strong> ha sido aprobada y ya está visible públicamente.</p>
      <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; border-radius: 4px; margin: 20px 0;">
        <p style="color: #065f46; margin: 0;">
          <strong>✨ Tu propiedad está activa</strong><br>
          Los compradores pueden verla y contactarte.
        </p>
      </div>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${EMAIL_CONFIG.baseUrl}/panel-agente" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Ver Mi Dashboard</a>
      </div>
    </div>
    ${getAntiSpamFooter()}
  </div>
</body>
</html>
      `;
      
    } else if (action === 'rejected') {
      subject = `❌ Tu propiedad "${propertyTitle}" necesita correcciones`;
      
      html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">❌ Correcciones Necesarias</h1>
    </div>
    <div style="padding: 30px;">
      <h2 style="color: #ef4444; margin: 0 0 16px 0; font-size: 20px;">Se requieren correcciones</h2>
      <p style="color: #374151; font-size: 16px;">Hola <strong>${agentName}</strong>,</p>
      <p style="color: #374151; font-size: 16px;">Tu propiedad <strong>"${propertyTitle}"</strong> necesita algunas correcciones antes de ser publicada.</p>
      <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 4px; margin: 20px 0;">
        <p style="color: #991b1b; margin: 0 0 8px 0;"><strong>Motivo del rechazo:</strong></p>
        <p style="color: #7f1d1d; margin: 0; font-weight: 600;">${rejectionReason?.label || 'No especificado'}</p>
        ${rejectionReason?.details ? `<p style="color: #991b1b; margin: 12px 0 0 0;">${rejectionReason.details}</p>` : ''}
      </div>
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px; margin: 20px 0;">
        <p style="color: #78350f; margin: 0;">
          <strong>💡 Qué hacer:</strong><br>
          1. Revisa y corrige los problemas señalados<br>
          2. Edita tu propiedad desde el dashboard<br>
          3. Reenvía para revisión (máximo 3 intentos)
        </p>
      </div>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${EMAIL_CONFIG.baseUrl}/panel-agente" style="background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Corregir Propiedad</a>
      </div>
    </div>
    ${getAntiSpamFooter()}
  </div>
</body>
</html>
      `;
    }

    const result = await sendEmail({
      to: resolvedEmail,
      subject,
      htmlContent: html,
      category: 'transactional',
      tags: [
        { name: 'notification_type', value: 'moderation' },
        { name: 'action', value: action },
      ],
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log("✅ Email sent successfully:", result.data);

    return new Response(JSON.stringify({ success: true, data: result.data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("❌ Error in send-moderation-notification:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
