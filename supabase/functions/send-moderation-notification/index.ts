import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  agentEmail: string;
  agentName: string;
  propertyTitle: string;
  action: 'approved' | 'rejected';
  rejectionReason?: any;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Received moderation notification request");
    const { agentEmail, agentName, propertyTitle, action, rejectionReason }: NotificationRequest = await req.json();
    
    console.log(`Sending ${action} notification to ${agentEmail} for property: ${propertyTitle}`);

    if (!agentEmail) {
      throw new Error("Agent email is required");
    }

    let subject = '';
    let html = '';

    if (action === 'approved') {
      subject = `✅ Tu propiedad "${propertyTitle}" ha sido aprobada`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #22c55e;">¡Felicidades ${agentName}!</h1>
          <p>Tu propiedad <strong>${propertyTitle}</strong> ha sido aprobada y ya está visible en nuestra plataforma.</p>
          <p>Los usuarios interesados podrán contactarte directamente.</p>
          <p style="margin-top: 20px; padding: 15px; background-color: #f3f4f6; border-left: 4px solid #22c55e;">
            <strong>Recuerda:</strong> Debes renovar tu propiedad cada 30 días para mantenerla activa. 
            Si no se renueva, se pausará automáticamente pero podrás reactivarla con un clic cuando lo necesites.
          </p>
          <br>
          <p>Saludos,<br><strong>Equipo Kentra</strong></p>
        </div>
      `;
    } else if (action === 'rejected') {
      subject = `❌ Tu propiedad "${propertyTitle}" necesita correcciones`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #ef4444;">Hola ${agentName},</h1>
          <p>Tu propiedad <strong>${propertyTitle}</strong> ha sido revisada y requiere algunas correcciones antes de ser publicada.</p>
          <div style="margin: 20px 0; padding: 15px; background-color: #fee2e2; border-left: 4px solid #ef4444;">
            <h2 style="margin-top: 0; color: #991b1b;">Motivo del rechazo:</h2>
            <p style="margin: 5px 0;"><strong>${rejectionReason.label}</strong></p>
            ${rejectionReason.details ? `<p style="margin: 5px 0; color: #7f1d1d;">${rejectionReason.details}</p>` : ''}
          </div>
          <div style="margin: 20px 0; padding: 15px; background-color: #dbeafe; border-left: 4px solid #3b82f6;">
            <h3 style="margin-top: 0;">¿Qué hacer ahora?</h3>
            <ol style="margin: 10px 0; padding-left: 20px;">
              <li>Accede a tu panel de agente</li>
              <li>Edita la propiedad rechazada</li>
              <li>Realiza las correcciones necesarias</li>
              <li>Haz clic en "Reenviar para Aprobación"</li>
            </ol>
            <p style="margin: 10px 0;"><strong>Tienes hasta 3 intentos de reenvío.</strong></p>
          </div>
          <br>
          <p>Saludos,<br><strong>Equipo Kentra</strong></p>
        </div>
      `;
    }

    console.log("Sending email via Resend...");
    const emailResponse = await resend.emails.send({
      from: "Kentra <noreply@kentra.com.mx>",
      to: [agentEmail],
      subject: subject,
      html: html,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-moderation-notification:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);