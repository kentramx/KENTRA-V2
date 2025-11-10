import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import React from 'react';
import { Resend } from 'resend';
import { renderAsync } from '@react-email/components';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';
import { ExpiryReminderEmail } from './_templates/expiry-reminder-email.tsx';

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

        // Render React Email template
        const html = await renderAsync(
          React.createElement(ExpiryReminderEmail, {
            agentName,
            propertyTitle: property.title,
            daysUntilExpiry: reminder.days,
            expiryDate: expiryDate.toLocaleDateString('es-MX', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            }),
            renewUrl: `https://kentra.com.mx/agent/dashboard`
          })
        );

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
