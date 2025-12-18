import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { sendEmail, getAntiSpamFooter, EMAIL_CONFIG } from '../_shared/emailHelper.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WhatsAppVerificationEmailRequest {
  userEmail: string;
  userName: string;
  whatsappNumber: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Security: Verify internal service token
    const authHeader = req.headers.get('Authorization');
    const internalToken = Deno.env.get('INTERNAL_SERVICE_TOKEN');
    
    if (internalToken && authHeader !== `Bearer ${internalToken}`) {
      const apiKey = req.headers.get('apikey');
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (apiKey !== serviceRoleKey) {
        console.warn('Unauthorized WhatsApp verification email attempt blocked');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    console.log("📧 Received WhatsApp verification email request");
    const { userEmail, userName, whatsappNumber }: WhatsAppVerificationEmailRequest = await req.json();
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!userEmail || !emailRegex.test(userEmail)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log(`📤 Sending WhatsApp verification confirmation to ${userEmail}`);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); padding: 40px 20px; text-align: center;">
      <div style="background-color: white; width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 40px;">✅</span>
      </div>
      <h1 style="color: white; margin: 0; font-size: 28px;">WhatsApp Verificado</h1>
      <p style="color: rgba(255, 255, 255, 0.95); margin: 10px 0 0; font-size: 16px;">Tu canal de contacto está activo</p>
    </div>

    <div style="padding: 40px 30px;">
      <p style="color: #374151; font-size: 16px;">Hola <strong>${userName}</strong>,</p>
      <p style="color: #374151; font-size: 16px;">¡Excelentes noticias! Hemos verificado exitosamente tu número de WhatsApp:</p>

      <div style="background-color: #F0FDF4; border: 2px solid #25D366; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
        <div style="color: #166534; font-size: 14px; font-weight: 600; text-transform: uppercase; margin-bottom: 8px;">Número Verificado</div>
        <div style="color: #15803D; font-size: 24px; font-weight: 700; font-family: monospace;">${whatsappNumber}</div>
      </div>

      <div style="background-color: #F9FAFB; border-radius: 8px; padding: 25px; margin: 24px 0;">
        <h3 style="color: #111827; font-size: 18px; font-weight: 600; margin: 0 0 15px;">¿Qué significa esto?</h3>
        <div style="margin: 12px 0;">
          <span style="color: #25D366; font-size: 20px; margin-right: 10px;">✓</span>
          <span style="color: #374151;">Contacto directo desde tus propiedades</span>
        </div>
        <div style="margin: 12px 0;">
          <span style="color: #25D366; font-size: 20px; margin-right: 10px;">✓</span>
          <span style="color: #374151;">Badge "WhatsApp Verificado" en tu perfil</span>
        </div>
        <div style="margin: 12px 0;">
          <span style="color: #25D366; font-size: 20px; margin-right: 10px;">✓</span>
          <span style="color: #374151;">Mejor posicionamiento en búsquedas</span>
        </div>
        <div style="margin: 12px 0;">
          <span style="color: #25D366; font-size: 20px; margin-right: 10px;">✓</span>
          <span style="color: #374151;">Más oportunidades de contacto</span>
        </div>
      </div>

      <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 20px; margin: 24px 0; border-radius: 4px;">
        <h4 style="color: #92400E; font-size: 16px; font-weight: 600; margin: 0 0 10px;">💡 Consejo Pro</h4>
        <p style="color: #78350F; font-size: 14px; margin: 0;">
          Responde rápidamente a los mensajes de WhatsApp para aumentar tus conversiones.
        </p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${EMAIL_CONFIG.baseUrl}/panel-agente" style="display: inline-block; background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Ver mi Dashboard</a>
      </div>
    </div>
    ${getAntiSpamFooter()}
  </div>
</body>
</html>
    `;

    const result = await sendEmail({
      to: userEmail,
      subject: '✅ WhatsApp Verificado - Canal de Contacto Activado',
      htmlContent: html,
      category: 'transactional',
      tags: [{ name: 'notification_type', value: 'whatsapp_verified' }],
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log("✅ WhatsApp verification email sent successfully:", result.data);

    return new Response(JSON.stringify({ success: true, data: result.data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("❌ Error in send-whatsapp-verification-email:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
