import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RoleChangeNotificationRequest {
  userEmail: string;
  userName: string;
  previousRole: string;
  newRole: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('send-role-change-notification invoked');

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, userName, previousRole, newRole }: RoleChangeNotificationRequest = await req.json();

    console.log('Sending role change notification:', { userEmail, userName, previousRole, newRole });

    // Format date
    const changeDate = new Date().toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const getRoleDisplayName = (role: string): string => {
      const roleNames: Record<string, string> = {
        'buyer': 'Particular',
        'agent': 'Agente Independiente',
        'agency': 'Inmobiliaria',
      };
      return roleNames[role] || role;
    };

    const getRoleFeatures = (role: string): string[] => {
      if (role === 'agent') {
        return [
          'Publica propiedades como agente independiente',
          'Accede a analytics de tus publicaciones',
          'Recibe notificaciones de interesados',
          'Gestiona tu portafolio de propiedades',
        ];
      } else if (role === 'agency') {
        return [
          'Gestiona un equipo de agentes',
          'Comparte inventario entre tu equipo',
          'Visualiza reportes consolidados',
          'Asigna propiedades a agentes específicos',
        ];
      }
      return [];
    };

    const features = getRoleFeatures(newRole);
    const featuresHtml = features.length > 0 
      ? `
        <p style="color: #4a4a4a; font-size: 16px; line-height: 26px; margin: 16px 40px;">
          Como <strong>${getRoleDisplayName(newRole)}</strong>, ahora tienes acceso a:
        </p>
        <div style="margin: 16px 40px;">
          ${features.map(f => `<p style="color: #4a4a4a; font-size: 15px; line-height: 24px; margin: 8px 0;">✓ ${f}</p>`).join('')}
        </div>
      `
      : '';

    // Build HTML directly
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;">
          <div style="background-color: #ffffff; margin: 0 auto; padding: 20px 0 48px; margin-bottom: 64px; border-radius: 8px; max-width: 600px;">
            <h1 style="color: #1a1a1a; font-size: 28px; font-weight: bold; margin: 40px 0 20px; padding: 0 40px; line-height: 1.3;">
              ¡Tu cuenta ha sido actualizada!
            </h1>
            
            <p style="color: #4a4a4a; font-size: 16px; line-height: 26px; margin: 16px 40px;">
              Hola ${userName},
            </p>
            
            <p style="color: #4a4a4a; font-size: 16px; line-height: 26px; margin: 16px 40px;">
              Tu tipo de cuenta en Kentra ha sido cambiado exitosamente.
            </p>

            <div style="background-color: #f0f4f8; border-radius: 8px; padding: 20px; margin: 24px 40px;">
              <p style="color: #1a1a1a; font-size: 14px; line-height: 24px; margin: 8px 0;">
                <strong>Tipo anterior:</strong> ${getRoleDisplayName(previousRole)}
              </p>
              <p style="color: #1a1a1a; font-size: 14px; line-height: 24px; margin: 8px 0;">
                <strong>Nuevo tipo:</strong> ${getRoleDisplayName(newRole)}
              </p>
              <p style="color: #1a1a1a; font-size: 14px; line-height: 24px; margin: 8px 0;">
                <strong>Fecha del cambio:</strong> ${changeDate}
              </p>
            </div>

            ${featuresHtml}

            <hr style="border-color: #e6ebf1; margin: 24px 40px;">

            <div style="text-align: center; margin: 32px 0;">
              <a href="https://kentramx.lovable.app/panel-agente" 
                 style="background-color: #2563eb; border-radius: 6px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; display: inline-block; padding: 12px 32px;">
                Ir a Mi Dashboard
              </a>
            </div>

            <p style="color: #8898aa; font-size: 14px; line-height: 24px; margin: 24px 40px;">
              Si no realizaste este cambio o tienes alguna pregunta, por favor contáctanos de inmediato.
            </p>

            <hr style="border-color: #e6ebf1; margin: 24px 40px;">

            <p style="color: #8898aa; font-size: 12px; line-height: 20px; margin: 32px 40px; text-align: center;">
              <a href="https://kentra.com.mx" target="_blank" style="color: #2563eb; text-decoration: underline;">
                Kentra
              </a>
              <br>
              Tu plataforma inmobiliaria de confianza
            </p>
          </div>
        </body>
      </html>
    `;

    // Send email using Resend
    const emailResponse = await resend.emails.send({
      from: "Kentra <noreply@kentra.com.mx>",
      to: [userEmail],
      subject: "Tu tipo de cuenta en Kentra ha sido actualizado",
      html,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true,
      emailResponse 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-role-change-notification function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
