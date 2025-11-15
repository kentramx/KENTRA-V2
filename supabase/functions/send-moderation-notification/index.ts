import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from 'https://esm.sh/resend@2.0.0';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
    
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 20px; text-align: center;">
      <h1 style="color: white; margin: 0 0 8px 0; font-size: 28px; font-weight: bold;">Kentra</h1>
      <div style="background-color: rgba(255,255,255,0.2); display: inline-block; padding: 8px 16px; border-radius: 20px;">
        <span style="color: white; font-size: 14px; font-weight: 600;">✅ Propiedad Aprobada</span>
      </div>
    </div>

    <div style="padding: 40px 30px;">
      <h2 style="color: #10b981; margin: 0 0 16px 0; font-size: 24px; font-weight: bold;">¡Buenas noticias!</h2>
      
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
        Hola <strong>${agentName}</strong>,
      </p>

      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
        Tu propiedad <strong>"${propertyTitle}"</strong> ha sido aprobada y ya está visible públicamente en la plataforma.
      </p>

      <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; border-radius: 4px; margin: 24px 0;">
        <p style="color: #065f46; font-size: 14px; line-height: 1.6; margin: 0;">
          <strong>✨ Tu propiedad está activa</strong><br>
          Los compradores pueden verla y contactarte. Recuerda renovarla cada 30 días para mantenerla visible.
        </p>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="https://kentra.com.mx/agent/dashboard" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">
          Ver Mi Dashboard
        </a>
      </div>

      <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 32px;">
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-bottom: 8px;">
          <strong>¿Necesitas ayuda?</strong>
        </p>
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
          Contáctanos en <a href="mailto:contact@kentra.com.mx" style="color: #10b981; text-decoration: none;">contact@kentra.com.mx</a>
        </p>
      </div>
    </div>

    <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0 0 8px 0;">
        © ${new Date().getFullYear()} Kentra. Todos los derechos reservados.
      </p>
      <div style="margin-top: 12px;">
        <a href="https://www.instagram.com/kentra.mx" style="color: #10b981; text-decoration: none; margin: 0 8px; font-size: 12px;">Instagram</a>
        <a href="https://www.facebook.com/profile.php?id=61583478575484" style="color: #10b981; text-decoration: none; margin: 0 8px; font-size: 12px;">Facebook</a>
      </div>
    </div>

  </div>
</body>
</html>
      `;
      
      console.log("✅ Approved email template rendered");
      
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
    
    <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 40px 20px; text-align: center;">
      <h1 style="color: white; margin: 0 0 8px 0; font-size: 28px; font-weight: bold;">Kentra</h1>
      <div style="background-color: rgba(255,255,255,0.2); display: inline-block; padding: 8px 16px; border-radius: 20px;">
        <span style="color: white; font-size: 14px; font-weight: 600;">❌ Correcciones Necesarias</span>
      </div>
    </div>

    <div style="padding: 40px 30px;">
      <h2 style="color: #ef4444; margin: 0 0 16px 0; font-size: 24px; font-weight: bold;">Se requieren correcciones</h2>
      
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
        Hola <strong>${agentName}</strong>,
      </p>

      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
        Tu propiedad <strong>"${propertyTitle}"</strong> ha sido revisada y necesita algunas correcciones antes de ser publicada.
      </p>

      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 4px; margin: 24px 0;">
        <p style="color: #991b1b; font-size: 14px; line-height: 1.6; margin: 0 0 12px 0;">
          <strong>Motivo del rechazo:</strong>
        </p>
        <p style="color: #7f1d1d; font-size: 15px; line-height: 1.6; margin: 0; font-weight: 600;">
          ${rejectionReason?.label || 'No especificado'}
        </p>
        ${rejectionReason?.details ? `
          <p style="color: #991b1b; font-size: 14px; line-height: 1.6; margin: 12px 0 0 0;">
            ${rejectionReason.details}
          </p>
        ` : ''}
      </div>

      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px; margin: 24px 0;">
        <p style="color: #78350f; font-size: 14px; line-height: 1.6; margin: 0;">
          <strong>💡 Qué hacer:</strong><br>
          1. Revisa y corrige los problemas señalados<br>
          2. Edita tu propiedad desde el dashboard<br>
          3. Reenvía para revisión (máximo 3 intentos)
        </p>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="https://kentra.com.mx/agent/dashboard" style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">
          Corregir Propiedad
        </a>
      </div>

      <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 32px;">
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-bottom: 8px;">
          <strong>¿Necesitas ayuda?</strong>
        </p>
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
          Contáctanos en <a href="mailto:contact@kentra.com.mx" style="color: #ef4444; text-decoration: none;">contact@kentra.com.mx</a>
        </p>
      </div>
    </div>

    <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0 0 8px 0;">
        © ${new Date().getFullYear()} Kentra. Todos los derechos reservados.
      </p>
      <div style="margin-top: 12px;">
        <a href="https://www.instagram.com/kentra.mx" style="color: #ef4444; text-decoration: none; margin: 0 8px; font-size: 12px;">Instagram</a>
        <a href="https://www.facebook.com/profile.php?id=61583478575484" style="color: #ef4444; text-decoration: none; margin: 0 8px; font-size: 12px;">Facebook</a>
      </div>
    </div>

  </div>
</body>
</html>
      `;
      
      console.log("❌ Rejected email template rendered");
    }

    console.log("📮 Sending email via Resend...");
    const emailResponse = await resend.emails.send({
      from: "Kentra <noreply@updates.kentra.com.mx>",
      to: [resolvedEmail],
      subject: subject,
      html: html,
    });

    console.log("✅ Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
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
