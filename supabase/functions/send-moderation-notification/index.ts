import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import React from 'npm:react@18.3.1';
import { Resend } from 'npm:resend@2.0.0';
import { renderAsync } from 'npm:@react-email/components@0.0.22';
import { ApprovedEmail } from './_templates/approved-email.tsx';
import { RejectedEmail } from './_templates/rejected-email.tsx';

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
    const { agentEmail, agentName, propertyTitle, action, rejectionReason }: NotificationRequest = await req.json();
    
    console.log(`📤 Sending ${action} notification to ${agentEmail} for property: ${propertyTitle}`);

    if (!agentEmail) {
      throw new Error("Agent email is required");
    }

    let subject = '';
    let html = '';

    if (action === 'approved') {
      subject = `✅ Tu propiedad "${propertyTitle}" ha sido aprobada`;
      
      // Render React Email template
      html = await renderAsync(
        React.createElement(ApprovedEmail, {
          agentName,
          propertyTitle,
        })
      );
      
      console.log("✅ Approved email template rendered");
      
    } else if (action === 'rejected') {
      subject = `❌ Tu propiedad "${propertyTitle}" necesita correcciones`;
      
      // Render React Email template
      html = await renderAsync(
        React.createElement(RejectedEmail, {
          agentName,
          propertyTitle,
          rejectionReason: rejectionReason || { label: 'No especificado' },
        })
      );
      
      console.log("❌ Rejected email template rendered");
    }

    console.log("📮 Sending email via Resend...");
    const emailResponse = await resend.emails.send({
      from: "Kentra <noreply@kentra.com.mx>",
      to: [agentEmail],
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
