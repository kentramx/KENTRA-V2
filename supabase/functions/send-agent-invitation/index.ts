import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from 'https://esm.sh/resend@2.0.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticación
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { agencyId, email, role, agencyName, inviterName } = await req.json() as InvitationRequest;

    console.log('📧 Sending invitation:', { agencyId, email, role });

    // Obtener el plan de la inmobiliaria y validar límite de agentes
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

    // Obtener información de suscripción incluyendo límite de agentes
    const { data: subscription } = await supabase
      .rpc('get_user_subscription_info', { user_uuid: agency.owner_id })
      .single();

    if (!subscription || !subscription.has_subscription) {
      return new Response(
        JSON.stringify({ error: 'La inmobiliaria no tiene una suscripción activa' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const maxAgents = subscription.features?.max_agents || 5;

    // Contar agentes actuales
    const { count: currentAgentsCount } = await supabase
      .from('agency_agents')
      .select('*', { count: 'exact', head: true })
      .eq('agency_id', agencyId);

    // Contar invitaciones pendientes y aceptadas
    const { count: pendingInvitationsCount } = await supabase
      .from('agency_invitations')
      .select('*', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
      .in('status', ['pending', 'accepted']);

    const totalSlots = (currentAgentsCount || 0) + (pendingInvitationsCount || 0);

    if (totalSlots >= maxAgents) {
      return new Response(
        JSON.stringify({ 
          error: `Límite de agentes alcanzado. Tu plan permite ${maxAgents} agentes (actualmente: ${currentAgentsCount} agentes + ${pendingInvitationsCount} invitaciones). Mejora tu plan para agregar más.` 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar si ya existe una invitación pendiente
    const { data: existingInvitation } = await supabase
      .from('agency_invitations')
      .select('id, status')
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

    // Verificar si el usuario ya es parte del equipo consultando la tabla profiles
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existingProfile) {
      const { data: existingAgent } = await supabase
        .from('agency_agents')
        .select('id')
        .eq('agency_id', agencyId)
        .eq('agent_id', existingProfile.id)
        .single();

      if (existingAgent) {
        return new Response(
          JSON.stringify({ error: 'Este agente ya es parte del equipo' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Crear la invitación en la base de datos
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

    // URL de aceptación de invitación
    const baseUrl = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || 
                    'https://76efa12d-6203-4dda-a876-e21654ac3abe.lovableproject.com';
    const invitationUrl = `${baseUrl}/unirse-equipo?token=${invitation.token}`;

    // Enviar email de invitación
    const { error: emailError } = await resend.emails.send({
      from: "Kentra <noreply@updates.kentra.com.mx>",
      to: [email],
      subject: `${inviterName} te invita a unirte a ${agencyName} en Kentra`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🎉 ¡Invitación de Equipo!</h1>
            </div>
            
            <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-bottom: 20px;">
                Hola,
              </p>
              
              <p style="font-size: 16px; margin-bottom: 20px;">
                <strong>${inviterName}</strong> te ha invitado a unirte al equipo de <strong>${agencyName}</strong> en Kentra como <strong>${role === 'manager' ? 'Gerente' : 'Agente'}</strong>.
              </p>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0;">
                <h3 style="margin-top: 0; color: #667eea;">🏢 Detalles de la Invitación</h3>
                <p style="margin: 10px 0;"><strong>Inmobiliaria:</strong> ${agencyName}</p>
                <p style="margin: 10px 0;"><strong>Rol:</strong> ${role === 'manager' ? 'Gerente' : 'Agente'}</p>
                <p style="margin: 10px 0;"><strong>Invitado por:</strong> ${inviterName}</p>
              </div>
              
              <p style="font-size: 16px; margin-bottom: 25px;">
                Al unirte al equipo podrás:
              </p>
              
              <ul style="font-size: 15px; line-height: 1.8; margin-bottom: 25px;">
                <li>Gestionar el inventario compartido de propiedades</li>
                <li>Acceder a herramientas profesionales de venta</li>
                <li>Colaborar con otros agentes del equipo</li>
                <li>Beneficiarte del plan de suscripción de la inmobiliaria</li>
              </ul>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${invitationUrl}" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; 
                          padding: 14px 32px; 
                          text-decoration: none; 
                          border-radius: 8px; 
                          font-weight: bold; 
                          font-size: 16px;
                          display: inline-block;
                          box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                  ✅ Aceptar Invitación
                </a>
              </div>
              
              <p style="font-size: 14px; color: #666; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                O copia y pega este enlace en tu navegador:<br>
                <a href="${invitationUrl}" style="color: #667eea; word-break: break-all;">${invitationUrl}</a>
              </p>
              
              <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #ffc107;">
                <p style="margin: 0; font-size: 14px; color: #856404;">
                  ⏰ <strong>Importante:</strong> Esta invitación expira en 7 días.
                </p>
              </div>
              
              <p style="font-size: 14px; color: #666; margin-top: 25px;">
                Si no esperabas esta invitación o no deseas unirte al equipo, puedes ignorar este mensaje.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
              <p style="color: #999; font-size: 12px; margin: 5px 0;">
                © ${new Date().getFullYear()} Kentra - Plataforma Inmobiliaria
              </p>
              <p style="color: #999; font-size: 12px; margin: 5px 0;">
                <a href="https://kentra.com.mx" style="color: #667eea; text-decoration: none;">kentra.com.mx</a>
              </p>
            </div>
          </body>
        </html>
      `,
    });

    if (emailError) {
      console.error('Error sending email:', emailError);
      throw emailError;
    }

    console.log('✅ Invitation sent successfully to:', email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Invitación enviada exitosamente',
        invitationId: invitation.id 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('❌ Error in send-agent-invitation:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Error interno del servidor' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});