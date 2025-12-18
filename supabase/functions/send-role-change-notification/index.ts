import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { sendEmail, getAntiSpamFooter, EMAIL_CONFIG } from '../_shared/emailHelper.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RoleChangeNotificationRequest {
  userEmail: string;
  userName: string;
  previousRole: string;
  newRole: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('send-role-change-notification invoked');

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
        console.warn('Unauthorized role change notification attempt blocked');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const { userEmail, userName, previousRole, newRole }: RoleChangeNotificationRequest = await req.json();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!userEmail || !emailRegex.test(userEmail)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Sending role change notification:', { userEmail, previousRole, newRole });

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
        'developer': 'Desarrolladora',
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
      } else if (role === 'developer') {
        return [
          'Gestiona proyectos de desarrollo inmobiliario',
          'Administra unidades y disponibilidad',
          'Accede a reportes y analíticos avanzados',
          'Colabora con tu equipo de ventas',
        ];
      }
      return [];
    };

    const features = getRoleFeatures(newRole);
    const featuresHtml = features.length > 0 
      ? `
        <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="color: #065f46; font-weight: bold; margin: 0 0 12px 0;">Como ${getRoleDisplayName(newRole)}, ahora tienes acceso a:</p>
          ${features.map(f => `<p style="color: #374151; margin: 8px 0;">✓ ${f}</p>`).join('')}
        </div>
      `
      : '';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">¡Tu cuenta ha sido actualizada!</h1>
    </div>
    <div style="padding: 30px;">
      <p style="color: #374151; font-size: 16px;">Hola ${userName},</p>
      <p style="color: #374151; font-size: 16px;">Tu tipo de cuenta en Kentra ha sido cambiado exitosamente.</p>

      <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <p style="margin: 8px 0;"><strong>Tipo anterior:</strong> ${getRoleDisplayName(previousRole)}</p>
        <p style="margin: 8px 0;"><strong>Nuevo tipo:</strong> ${getRoleDisplayName(newRole)}</p>
        <p style="margin: 8px 0;"><strong>Fecha del cambio:</strong> ${changeDate}</p>
      </div>

      ${featuresHtml}

      <div style="text-align: center; margin: 24px 0;">
        <a href="${EMAIL_CONFIG.baseUrl}/panel-agente" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Ir a Mi Dashboard</a>
      </div>

      <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
        Si no realizaste este cambio o tienes alguna pregunta, por favor contáctanos de inmediato.
      </p>
    </div>
    ${getAntiSpamFooter()}
  </div>
</body>
</html>
    `;

    const result = await sendEmail({
      to: userEmail,
      subject: 'Tu tipo de cuenta en Kentra ha sido actualizado',
      htmlContent: html,
      category: 'transactional',
      tags: [
        { name: 'notification_type', value: 'role_change' },
        { name: 'new_role', value: newRole },
      ],
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log("Email sent successfully:", result.data);

    return new Response(JSON.stringify({ success: true, emailResponse: result.data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-role-change-notification:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
