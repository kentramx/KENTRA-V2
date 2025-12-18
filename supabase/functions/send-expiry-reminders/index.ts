import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';
import { sendEmail, getAntiSpamFooter, EMAIL_CONFIG } from '../_shared/emailHelper.ts';

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

      const { data: properties, error: propertiesError } = await supabase
        .from('properties')
        .select(`id, title, agent_id, expires_at, profiles:agent_id (id, name)`)
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
          console.log(`⏭️ Reminder already sent for property ${property.id}`);
          continue;
        }

        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(property.agent_id);
        
        if (userError || !userData?.user?.email) {
          console.error(`❌ Could not get email for agent ${property.agent_id}:`, userError);
          continue;
        }

        const agentEmail = userData.user.email;
        const agentProfile = Array.isArray(property.profiles) ? property.profiles[0] : property.profiles;
        const agentName = agentProfile?.name || 'Agente';
        const expiryDate = new Date(property.expires_at);

        console.log(`📤 Sending ${reminder.days}-day reminder to ${agentEmail}`);

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
    <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">Kentra</h1>
    </div>
    <div style="padding: 30px;">
      <div style="background-color: ${urgencyColor}; color: white; padding: 12px 20px; border-radius: 6px; text-align: center; font-weight: bold; margin-bottom: 24px;">
        ${urgencyText}: Tu propiedad expira en ${reminder.days} día${reminder.days > 1 ? 's' : ''}
      </div>
      <p style="color: #374151; font-size: 16px;">Hola <strong>${agentName}</strong>,</p>
      <p style="color: #374151; font-size: 16px;">
        Tu propiedad <strong>"${property.title}"</strong> expirará el 
        <strong>${expiryDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
      </p>
      <div style="background: #fef3c7; border-left: 4px solid ${urgencyColor}; padding: 16px; border-radius: 4px; margin: 20px 0;">
        <p style="color: #78350f; margin: 0;">
          <strong>⚠️ Importante:</strong> Si no renuevas tu propiedad, se pausará automáticamente y dejará de ser visible.
        </p>
      </div>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${EMAIL_CONFIG.baseUrl}/panel-agente" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Renovar Propiedad</a>
      </div>
    </div>
    ${getAntiSpamFooter()}
  </div>
</body>
</html>
        `;

        const result = await sendEmail({
          to: agentEmail,
          subject: `⏰ Tu propiedad "${property.title}" expira en ${reminder.days} día${reminder.days > 1 ? 's' : ''}`,
          htmlContent: html,
          category: 'transactional',
          tags: [
            { name: 'notification_type', value: 'expiry_reminder' },
            { name: 'days_before', value: reminder.days.toString() },
          ],
        });

        if (!result.success) {
          console.error(`❌ Error sending email:`, result.error);
          continue;
        }

        console.log(`✅ Email sent successfully:`, result.data);

        // Record reminder sent
        await supabase.from('property_expiry_reminders').insert({
          property_id: property.id,
          agent_id: property.agent_id,
          days_before: reminder.days
        });

        totalSent++;
      }
    }

    console.log(`🎉 Expiry reminders completed. Total sent: ${totalSent}`);

    return new Response(
      JSON.stringify({ success: true, remindersSent: totalSent }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
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
