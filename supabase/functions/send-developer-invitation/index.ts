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
  developerId: string;
  email: string;
  role: 'member' | 'manager';
  developerName: string;
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

    const { developerId, email, role, developerName, inviterName } = await req.json() as InvitationRequest;

    console.log('📧 Sending developer invitation:', { developerId, email, role });

    // Validate developer
    const { data: developer } = await supabase
      .from('developers')
      .select('owner_id')
      .eq('id', developerId)
      .single();

    if (!developer) {
      return new Response(
        JSON.stringify({ error: 'Desarrolladora no encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get subscription info
    const { data: subscription, error: subError } = await supabase
      .rpc('get_user_subscription_info', { user_uuid: developer.owner_id });
    
    if (subError || !subscription?.has_subscription) {
      return new Response(
        JSON.stringify({ error: 'La desarrolladora no tiene una suscripción activa' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const maxAgents = subscription.features?.max_agents || 2;

    // Count current team
    const { count: currentMembersCount } = await supabase
      .from('developer_team')
      .select('*', { count: 'exact', head: true })
      .eq('developer_id', developerId);

    const { count: pendingInvitationsCount } = await supabase
      .from('developer_invitations')
      .select('*', { count: 'exact', head: true })
      .eq('developer_id', developerId)
      .eq('status', 'pending');

    const totalSlots = (currentMembersCount || 0) + (pendingInvitationsCount || 0);

    if (maxAgents !== -1 && totalSlots >= maxAgents) {
      return new Response(
        JSON.stringify({ error: `Límite de miembros alcanzado (${maxAgents}). Mejora tu plan para agregar más.` }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check existing invitation
    const { data: existingInvitation } = await supabase
      .from('developer_invitations')
      .select('id')
      .eq('developer_id', developerId)
      .eq('email', email)
      .eq('status', 'pending')
      .single();

    if (existingInvitation) {
      return new Response(
        JSON.stringify({ error: 'Ya existe una invitación pendiente para este email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get inviter user
    const { data: { user: inviter } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    // Create invitation
    const { data: invitation, error: invError } = await supabase
      .from('developer_invitations')
      .insert({
        developer_id: developerId,
        email,
        role,
        invited_by: inviter?.id
      })
      .select()
      .single();

    if (invError) {
      console.error('Error creating invitation:', invError);
      throw invError;
    }

    const invitationUrl = `${EMAIL_CONFIG.baseUrl}/unirse-equipo?token=${invitation.token}&type=developer`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px;">🏗️ ¡Invitación de Desarrolladora!</h1>
    </div>
    
    <div style="padding: 30px;">
      <p style="color: #374151; font-size: 16px;">Hola,</p>
      <p style="color: #374151; font-size: 16px;">
        <strong>${inviterName}</strong> te ha invitado a unirte al equipo de <strong>${developerName}</strong> en Kentra como <strong>${role === 'manager' ? 'Gerente' : 'Miembro del equipo'}</strong>.
      </p>
      
      <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #10b981;">
        <h3 style="margin: 0 0 12px 0; color: #059669;">🏢 Detalles de la Invitación</h3>
        <p style="margin: 8px 0;"><strong>Desarrolladora:</strong> ${developerName}</p>
        <p style="margin: 8px 0;"><strong>Rol:</strong> ${role === 'manager' ? 'Gerente' : 'Miembro del equipo'}</p>
        <p style="margin: 8px 0;"><strong>Invitado por:</strong> ${inviterName}</p>
      </div>
      
      <p style="color: #374151; font-size: 16px;">Al unirte al equipo podrás:</p>
      <ul style="color: #374151; font-size: 15px; line-height: 1.8;">
        <li>Gestionar proyectos inmobiliarios de la desarrolladora</li>
        <li>Administrar unidades y disponibilidad</li>
        <li>Acceder a reportes y analíticos avanzados</li>
        <li>Colaborar con el equipo de ventas</li>
      </ul>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${invitationUrl}" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">✅ Aceptar Invitación</a>
      </div>
      
      <p style="font-size: 14px; color: #6b7280; margin-top: 24px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
        O copia y pega este enlace:<br>
        <a href="${invitationUrl}" style="color: #10b981; word-break: break-all;">${invitationUrl}</a>
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
      subject: `${inviterName} te invita a unirte a ${developerName} en Kentra`,
      htmlContent: html,
      category: 'transactional',
      tags: [
        { name: 'notification_type', value: 'developer_invitation' },
        { name: 'developer_id', value: developerId },
      ],
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('✅ Developer invitation sent successfully to:', email);

    return new Response(
      JSON.stringify({ success: true, message: 'Invitación enviada exitosamente', invitationId: invitation.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in send-developer-invitation:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
