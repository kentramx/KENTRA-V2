import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from 'https://esm.sh/resend@2.0.0';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
    // Security: Verify internal service token to prevent unauthorized calls
    const authHeader = req.headers.get('Authorization');
    const internalToken = Deno.env.get('INTERNAL_SERVICE_TOKEN');
    
    // If internal token is configured, require it for non-authenticated calls
    if (internalToken && authHeader !== `Bearer ${internalToken}`) {
      // Fall back to checking if this is a legitimate Supabase service call
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

    const subject = '✅ WhatsApp Verificado - Canal de Contacto Activado';
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    
    <!-- Header con ícono de WhatsApp -->
    <div style="background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); padding: 40px 20px; text-align: center;">
      <div style="background-color: white; width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" fill="#25D366"/>
          <path d="M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.893c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652c1.746.943 3.71 1.444 5.71 1.447h.006c6.585 0 11.946-5.336 11.949-11.896 0-3.176-1.24-6.165-3.48-8.45zm-8.475 18.3c-1.776 0-3.52-.477-5.042-1.378l-.362-.214-3.742.98 1.002-3.63-.236-.374a9.86 9.86 0 0 1-1.517-5.26c.003-5.45 4.457-9.884 9.939-9.884 2.654 0 5.145 1.035 7.021 2.91a9.816 9.816 0 0 1 2.908 7.01c-.004 5.45-4.458 9.885-9.97 9.885z" fill="#25D366"/>
        </svg>
      </div>
      <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">
        WhatsApp Verificado ✅
      </h1>
      <p style="color: rgba(255, 255, 255, 0.95); margin: 10px 0 0; font-size: 16px;">
        Tu canal de contacto está activo
      </p>
    </div>

    <!-- Body -->
    <div style="padding: 40px 30px;">
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
        Hola <strong>${userName}</strong>,
      </p>
      
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
        ¡Excelentes noticias! Hemos verificado exitosamente tu número de WhatsApp:
      </p>

      <!-- WhatsApp Number Card -->
      <div style="background-color: #F0FDF4; border: 2px solid #25D366; border-radius: 8px; padding: 20px; margin: 0 0 30px; text-align: center;">
        <div style="color: #166534; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
          Número Verificado
        </div>
        <div style="color: #15803D; font-size: 24px; font-weight: 700; font-family: monospace;">
          ${whatsappNumber}
        </div>
      </div>

      <!-- Benefits Section -->
      <div style="background-color: #F9FAFB; border-radius: 8px; padding: 25px; margin: 0 0 30px;">
        <h3 style="color: #111827; font-size: 18px; font-weight: 600; margin: 0 0 15px;">
          ¿Qué significa esto?
        </h3>
        
        <div style="margin: 0 0 15px;">
          <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
            <span style="color: #25D366; font-size: 20px; margin-right: 10px;">✓</span>
            <p style="color: #4B5563; font-size: 15px; line-height: 1.5; margin: 0;">
              <strong>Contacto directo:</strong> Los compradores pueden contactarte por WhatsApp desde tus propiedades
            </p>
          </div>
          
          <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
            <span style="color: #25D366; font-size: 20px; margin-right: 10px;">✓</span>
            <p style="color: #4B5563; font-size: 15px; line-height: 1.5; margin: 0;">
              <strong>Mayor confianza:</strong> Tu perfil muestra el badge "WhatsApp Verificado"
            </p>
          </div>
          
          <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
            <span style="color: #25D366; font-size: 20px; margin-right: 10px;">✓</span>
            <p style="color: #4B5563; font-size: 15px; line-height: 1.5; margin: 0;">
              <strong>Mejor posicionamiento:</strong> Apareces más arriba en búsquedas
            </p>
          </div>
          
          <div style="display: flex; align-items: flex-start;">
            <span style="color: #25D366; font-size: 20px; margin-right: 10px;">✓</span>
            <p style="color: #4B5563; font-size: 15px; line-height: 1.5; margin: 0;">
              <strong>Más oportunidades:</strong> Los compradores prefieren agentes con contacto verificado
            </p>
          </div>
        </div>
      </div>

      <!-- Tips Section -->
      <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 20px; margin: 0 0 30px; border-radius: 4px;">
        <h4 style="color: #92400E; font-size: 16px; font-weight: 600; margin: 0 0 10px;">
          💡 Consejo Pro
        </h4>
        <p style="color: #78350F; font-size: 14px; line-height: 1.5; margin: 0;">
          Responde rápidamente a los mensajes de WhatsApp para aumentar tus conversiones. 
          Los compradores valoran la atención inmediata.
        </p>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://kentramx.lovable.app/panel-agente" 
           style="display: inline-block; background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(37, 211, 102, 0.3);">
          Ver mi Dashboard
        </a>
      </div>

      <p style="color: #6B7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0; text-align: center;">
        Si tienes alguna pregunta, estamos aquí para ayudarte.
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #F9FAFB; padding: 30px; text-align: center; border-top: 1px solid #E5E7EB;">
      <p style="color: #6B7280; font-size: 14px; margin: 0 0 10px;">
        <strong>Kentra</strong> - Tu plataforma inmobiliaria de confianza
      </p>
      <div style="margin: 15px 0;">
        <a href="https://www.instagram.com/kentra.mx" style="color: #6B7280; text-decoration: none; margin: 0 10px; font-size: 14px;">Instagram</a>
        <span style="color: #D1D5DB;">|</span>
        <a href="https://www.facebook.com/profile.php?id=61583478575484" style="color: #6B7280; text-decoration: none; margin: 0 10px; font-size: 14px;">Facebook</a>
      </div>
      <p style="color: #9CA3AF; font-size: 12px; margin: 10px 0 0;">
        © ${new Date().getFullYear()} Kentra. Todos los derechos reservados.
      </p>
    </div>

  </div>
</body>
</html>
`;

    const { data, error } = await resend.emails.send({
      from: 'Kentra <noreply@updates.kentra.com.mx>',
      to: [userEmail],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error("❌ Error sending email:", error);
      throw error;
    }

    console.log("✅ WhatsApp verification email sent successfully:", data);

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("❌ Error in send-whatsapp-verification-email function:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
