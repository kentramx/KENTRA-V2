import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  recipientId: string;
  senderName: string;
  messageContent: string;
  messageType: 'text' | 'image';
  conversationId: string;
  propertyTitle?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipientId, senderName, messageContent, messageType, conversationId, propertyTitle }: NotificationRequest = await req.json();

    // Crear cliente de Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener las preferencias de notificación del usuario
    const { data: preferences, error: preferencesError } = await supabase
      .from('notification_preferences')
      .select('email_new_messages')
      .eq('user_id', recipientId)
      .single();

    if (preferencesError || !preferences) {
      console.error('Error fetching preferences:', preferencesError);
      return new Response(JSON.stringify({ error: 'Preferences not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar si el usuario tiene notificaciones por email activadas
    if (!preferences.email_new_messages) {
      console.log('User has email notifications disabled for new messages');
      return new Response(JSON.stringify({ message: 'Email notifications disabled for new messages' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Obtener el email del usuario desde auth.users
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(recipientId);

    if (userError || !user?.email) {
      console.error('Error fetching user email:', userError);
      return new Response(JSON.stringify({ error: 'User email not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Preparar el contenido del email
    const emailSubject = `Nuevo mensaje de ${senderName}`;
    const messagePreview = messageType === 'image' 
      ? '📷 Te envió una imagen' 
      : messageContent.substring(0, 100) + (messageContent.length > 100 ? '...' : '');

    const propertyInfo = propertyTitle ? `<p style="color: #666; font-size: 14px;">Propiedad: <strong>${propertyTitle}</strong></p>` : '';

    // Enviar el email
    const emailResponse = await resend.emails.send({
      from: "Notificaciones <onboarding@resend.dev>",
      to: [user.email],
      subject: emailSubject,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">💬 Nuevo Mensaje</h1>
            </div>
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-bottom: 10px;">
                <strong>${senderName}</strong> te ha enviado un mensaje:
              </p>
              ${propertyInfo}
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                <p style="margin: 0; font-size: 15px; color: #555;">${messagePreview}</p>
              </div>
              <a href="${supabaseUrl.replace('.supabase.co', '.lovable.app')}/messages?conversation=${conversationId}" 
                 style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 10px;">
                Ver Conversación
              </a>
              <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                Si no deseas recibir estas notificaciones, puedes desactivarlas en la configuración de tu perfil.
              </p>
            </div>
          </body>
        </html>
      `,
    });

    console.log('Email sent successfully:', emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in send-message-notification function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};

serve(handler);
