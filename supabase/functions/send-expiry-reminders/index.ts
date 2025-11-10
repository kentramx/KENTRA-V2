import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from 'https://esm.sh/resend@2.0.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🔔 Starting expiry reminders check");

    // Initialize Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const today = new Date();
    const remindersToSend = [
      { days: 7, startDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), endDate: new Date(today.getTime() + 8 * 24 * 60 * 60 * 1000) },
      { days: 3, startDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000), endDate: new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000) },
      { days: 1, startDate: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000), endDate: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000) },
    ];

    let totalSent = 0;

    for (const reminder of remindersToSend) {
      console.log(`📅 Checking for ${reminder.days}-day reminders...`);

      // Find properties expiring in this timeframe
      const { data: properties, error: propertiesError } = await supabase
        .from('properties')
        .select(`
          id,
          title,
          agent_id,
          expires_at,
          profiles:agent_id (
            id,
            name,
            email:id (
              email
            )
          )
        `)
        .eq('status', 'activa')
        .gte('expires_at', reminder.startDate.toISOString())
        .lt('expires_at', reminder.endDate.toISOString());

      if (propertiesError) {
        console.error(`❌ Error fetching properties:`, propertiesError);
        continue;
      }

      if (!properties || properties.length === 0) {
        console.log(`✅ No properties expiring in ${reminder.days} days`);
        continue;
      }

      console.log(`📧 Found ${properties.length} properties expiring in ${reminder.days} days`);

      for (const property of properties) {
        // Check if reminder already sent
        const { data: existingReminder } = await supabase
          .from('property_expiry_reminders')
          .select('id')
          .eq('property_id', property.id)
          .eq('days_before', reminder.days)
          .single();

        if (existingReminder) {
          console.log(`⏭️ Reminder already sent for property ${property.id} (${reminder.days} days)`);
          continue;
        }

        // Get agent email from auth.users
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(property.agent_id);
        
        if (userError || !userData?.user?.email) {
          console.error(`❌ Could not get email for agent ${property.agent_id}:`, userError);
          continue;
        }

        const agentEmail = userData.user.email;
        const agentProfile = Array.isArray(property.profiles) ? property.profiles[0] : property.profiles;
        const agentName = agentProfile?.name || 'Agente';
        const expiryDate = new Date(property.expires_at);

        console.log(`📤 Sending ${reminder.days}-day reminder to ${agentEmail} for property: ${property.title}`);

        // Build HTML email manually
        const urgencyColor = reminder.days === 1 ? '#ef4444' : reminder.days === 3 ? '#f97316' : '#eab308';
        const urgencyText = reminder.days === 1 ? 'URGENTE' : reminder.days === 3 ? 'Importante' : 'Recordatorio';
        
        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    
    <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 20px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">Kentra</h1>
    </div>

    <div style="padding: 40px 30px;">
      <div style="background-color: ${urgencyColor}; color: white; padding: 12px 20px; border-radius: 6px; text-align: center; font-weight: bold; margin-bottom: 24px;">
        ${urgencyText}: Tu propiedad expira en ${reminder.days} día${reminder.days > 1 ? 's' : ''}
      </div>

      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
        Hola <strong>${agentName}</strong>,
      </p>

      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
        Tu propiedad <strong>"${property.title}"</strong> expirará el <strong>${expiryDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
      </p>

      <div style="background-color: #f9fafb; border-left: 4px solid ${urgencyColor}; padding: 16px; border-radius: 4px; margin: 24px 0;">
        <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0;">
          <strong>⚠️ Importante:</strong> Si no renuevas tu propiedad antes de la fecha de expiración, se pausará automáticamente y dejará de ser visible en búsquedas. Podrás reactivarla con un clic cuando lo necesites.
        </p>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="https://kentra.com.mx/agent/dashboard" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">
          Renovar Propiedad Ahora
        </a>
      </div>

      <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 32px;">
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-bottom: 8px;">
          <strong>¿Necesitas ayuda?</strong>
        </p>
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
          Contáctanos en <a href="mailto:contact@kentra.com.mx" style="color: #6366f1; text-decoration: none;">contact@kentra.com.mx</a>
        </p>
      </div>
    </div>

    <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0 0 8px 0;">
        © ${new Date().getFullYear()} Kentra. Todos los derechos reservados.
      </p>
      <div style="margin-top: 12px;">
        <a href="https://www.instagram.com/kentra.mx" style="color: #6366f1; text-decoration: none; margin: 0 8px; font-size: 12px;">Instagram</a>
        <a href="https://www.facebook.com/profile.php?id=61583478575484" style="color: #6366f1; text-decoration: none; margin: 0 8px; font-size: 12px;">Facebook</a>
      </div>
    </div>

  </div>
</body>
</html>
        `;

        // Send email via Resend
        const emailResponse = await resend.emails.send({
          from: "Kentra <noreply@kentra.com.mx>",
          to: [agentEmail],
          subject: `⏰ Tu propiedad "${property.title}" expira en ${reminder.days} día${reminder.days > 1 ? 's' : ''}`,
          html: html,
        });

        if (emailResponse.error) {
          console.error(`❌ Error sending email:`, emailResponse.error);
          continue;
        }

        console.log(`✅ Email sent successfully:`, emailResponse);

        // Record reminder sent
        const { error: reminderError } = await supabase
          .from('property_expiry_reminders')
          .insert({
            property_id: property.id,
            agent_id: property.agent_id,
            days_before: reminder.days
          });

        if (reminderError) {
          console.error(`❌ Error recording reminder:`, reminderError);
        } else {
          totalSent++;
          console.log(`✅ Reminder recorded for property ${property.id}`);
        }
      }
    }

    console.log(`🎉 Expiry reminders process completed. Total sent: ${totalSent}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        remindersSent: totalSent,
        message: `Successfully sent ${totalSent} expiry reminders`
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("❌ Error in send-expiry-reminders:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
