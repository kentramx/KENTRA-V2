import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';
import { sendEmail, getAntiSpamFooter, EMAIL_CONFIG } from '../_shared/emailHelper.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  agencyId: string;
  email: string;
  role: 'agent' | 'manager';
  agencyName: string;
  inviterName: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { agencyId, email, role, agencyName, inviterName } = await req.json() as InvitationRequest;

    console.log('📧 Sending invitation:', { agencyId, email, role });

    // Validate agency
    const { data: agency } = await supabase
      .from('agencies')
      .select('owner_id')
      .eq('id', agencyId)
      .single();

    if (!agency) {
      return new Response(
        JSON.stringify({ error: 'Inmobiliaria no encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get subscription info
    const { data: subscription, error: subError } = await supabase
      .rpc('get_user_subscription_info', { user_uuid: agency.owner_id });
    
    if (subError || !subscription?.has_subscription) {
      return new Response(
        JSON.stringify({ error: 'La inmobiliaria no tiene una suscripción activa' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const maxAgents = subscription.features?.max_agents || 5;

    // Count current agents
    const { count: currentAgentsCount } = await supabase
      .from('agency_agents')
      .select('*', { count: 'exact', head: true })
      .eq('agency_id', agencyId);

    const { count: pendingInvitationsCount } = await supabase
      .from('agency_invitations')
      .select('*', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
      .in('status', ['pending', 'accepted']);

    const totalSlots = (currentAgentsCount || 0) + (pendingInvitationsCount || 0);

    if (totalSlots >= maxAgents) {
      return new Response(
        JSON.stringify({ error: `Límite de agentes alcanzado (${maxAgents}). Mejora tu plan para agregar más.` }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check existing invitation
    const { data: existingInvitation } = await supabase
      .from('agency_invitations')
      .select('id')
      .eq('agency_id', agencyId)
      .eq('email', email)
      .eq('status', 'pending')
      .single();

    if (existingInvitation) {
      return new Response(
        JSON.stringify({ error: 'Ya existe una invitación pendiente para este email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create invitation
    const { data: invitation, error: invError } = await supabase
      .from('agency_invitations')
      .insert({
        agency_id: agencyId,
        email,
        role,
        invited_by: (await supabase.auth.getUser(authHeader.replace('Bearer ', ''))).data.user?.id
      })
      .select()
      .single();

    if (invError) {
      console.error('Error creating invitation:', invError);
      throw invError;
    }

    const invitationUrl = `${EMAIL_CONFIG.baseUrl}/unirse-equipo?token=${invitation.token}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px;">🎉 ¡Invitación de Equipo!</h1>
    </div>
    
    <div style="padding: 30px;">
      <p style="color: #374151; font-size: 16px;">Hola,</p>
      <p style="color: #374151; font-size: 16px;">
        <strong>${inviterName}</strong> te ha invitado a unirte al equipo de <strong>${agencyName}</strong> en Kentra como <strong>${role === 'manager' ? 'Gerente' : 'Agente'}</strong>.
      </p>
      
      <div style="background: #f0f4ff; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #667eea;">
        <h3 style="margin: 0 0 12px 0; color: #667eea;">🏢 Detalles de la Invitación</h3>
        <p style="margin: 8px 0;"><strong>Inmobiliaria:</strong> ${agencyName}</p>
        <p style="margin: 8px 0;"><strong>Rol:</strong> ${role === 'manager' ? 'Gerente' : 'Agente'}</p>
        <p style="margin: 8px 0;"><strong>Invitado por:</strong> ${inviterName}</p>
      </div>
      
      <p style="color: #374151; font-size: 16px;">Al unirte al equipo podrás:</p>
      <ul style="color: #374151; font-size: 15px; line-height: 1.8;">
        <li>Gestionar el inventario compartido de propiedades</li>
        <li>Acceder a herramientas profesionales de venta</li>
        <li>Colaborar con otros agentes del equipo</li>
        <li>Beneficiarte del plan de suscripción de la inmobiliaria</li>
      </ul>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${invitationUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">✅ Aceptar Invitación</a>
      </div>
      
      <p style="font-size: 14px; color: #6b7280; margin-top: 24px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
        O copia y pega este enlace:<br>
        <a href="${invitationUrl}" style="color: #667eea; word-break: break-all;">${invitationUrl}</a>
      </p>
      
      <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #ffc107;">
        <p style="margin: 0; font-size: 14px; color: #856404;">
          ⏰ <strong>Importante:</strong> Esta invitación expira en 7 días.
        </p>
      </div>
    </div>
    ${getAntiSpamFooter()}
  </div>
</body>
</html>
    `;

    const result = await sendEmail({
      to: email,
      subject: `${inviterName} te invita a unirte a ${agencyName} en Kentra`,
      htmlContent: html,
      category: 'transactional',
      tags: [
        { name: 'notification_type', value: 'agency_invitation' },
        { name: 'agency_id', value: agencyId },
      ],
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('✅ Invitation sent successfully to:', email);

    return new Response(
      JSON.stringify({ success: true, message: 'Invitación enviada exitosamente', invitationId: invitation.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in send-agent-invitation:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
