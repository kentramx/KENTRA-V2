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
  developerId: string;
  email: string;
  role: 'member' | 'manager';
  developerName: string;
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

    const { developerId, email, role, developerName, inviterName } = await req.json() as InvitationRequest;

    console.log('📧 Sending developer invitation:', { developerId, email, role });

    // Obtener el owner de la desarrolladora
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

    // Obtener información de suscripción incluyendo límite de miembros
    const { data: subscription, error: subError } = await supabase
      .rpc('get_user_subscription_info', { user_uuid: developer.owner_id });
    
    if (subError) {
      console.error('Error fetching subscription:', subError);
      return new Response(
        JSON.stringify({ error: 'Error al verificar suscripción' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subscription || !subscription.has_subscription) {
      return new Response(
        JSON.stringify({ error: 'La desarrolladora no tiene una suscripción activa' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const maxAgents = subscription.features?.max_agents || 2;

    // Contar miembros actuales del equipo
    const { count: currentMembersCount } = await supabase
      .from('developer_team')
      .select('*', { count: 'exact', head: true })
      .eq('developer_id', developerId);

    // Contar invitaciones pendientes
    const { count: pendingInvitationsCount } = await supabase
      .from('developer_invitations')
      .select('*', { count: 'exact', head: true })
      .eq('developer_id', developerId)
      .eq('status', 'pending');

    const totalSlots = (currentMembersCount || 0) + (pendingInvitationsCount || 0);

    if (maxAgents !== -1 && totalSlots >= maxAgents) {
      return new Response(
        JSON.stringify({ 
          error: `Límite de miembros alcanzado. Tu plan permite ${maxAgents} miembros (actualmente: ${currentMembersCount} miembros + ${pendingInvitationsCount} invitaciones). Mejora tu plan para agregar más.` 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar si ya existe una invitación pendiente
    const { data: existingInvitation } = await supabase
      .from('developer_invitations')
      .select('id, status')
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

    // Verificar si el usuario ya es parte del equipo
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .ilike('name', email) // profiles no tiene email, usamos auth
      .single();

    // Buscar por auth.users
    const { data: authUser } = await supabase.auth.admin.listUsers();
    const userByEmail = authUser?.users?.find(u => u.email === email);

    if (userByEmail) {
      const { data: existingMember } = await supabase
        .from('developer_team')
        .select('id')
        .eq('developer_id', developerId)
        .eq('user_id', userByEmail.id)
        .single();

      if (existingMember) {
        return new Response(
          JSON.stringify({ error: 'Este usuario ya es parte del equipo' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Obtener el user_id del invitador
    const { data: { user: inviter } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    // Crear la invitación en la base de datos
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

    // URL de aceptación de invitación
    const baseUrl = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || 
                    'https://76efa12d-6203-4dda-a876-e21654ac3abe.lovableproject.com';
    const invitationUrl = `${baseUrl}/unirse-equipo?token=${invitation.token}&type=developer`;

    // Enviar email de invitación
    const { error: emailError } = await resend.emails.send({
      from: "Kentra <noreply@updates.kentra.com.mx>",
      to: [email],
      subject: `${inviterName} te invita a unirte a ${developerName} en Kentra`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🏗️ ¡Invitación de Desarrolladora!</h1>
            </div>
            
            <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-bottom: 20px;">
                Hola,
              </p>
              
              <p style="font-size: 16px; margin-bottom: 20px;">
                <strong>${inviterName}</strong> te ha invitado a unirte al equipo de <strong>${developerName}</strong> en Kentra como <strong>${role === 'manager' ? 'Gerente' : 'Miembro del equipo'}</strong>.
              </p>
              
              <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #10b981;">
                <h3 style="margin-top: 0; color: #059669;">🏢 Detalles de la Invitación</h3>
                <p style="margin: 10px 0;"><strong>Desarrolladora:</strong> ${developerName}</p>
                <p style="margin: 10px 0;"><strong>Rol:</strong> ${role === 'manager' ? 'Gerente' : 'Miembro del equipo'}</p>
                <p style="margin: 10px 0;"><strong>Invitado por:</strong> ${inviterName}</p>
              </div>
              
              <p style="font-size: 16px; margin-bottom: 25px;">
                Al unirte al equipo podrás:
              </p>
              
              <ul style="font-size: 15px; line-height: 1.8; margin-bottom: 25px;">
                <li>Gestionar proyectos inmobiliarios de la desarrolladora</li>
                <li>Administrar unidades y disponibilidad</li>
                <li>Acceder a reportes y analíticos avanzados</li>
                <li>Colaborar con el equipo de ventas</li>
              </ul>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${invitationUrl}" 
                   style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
                          color: white; 
                          padding: 14px 32px; 
                          text-decoration: none; 
                          border-radius: 8px; 
                          font-weight: bold; 
                          font-size: 16px;
                          display: inline-block;
                          box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);">
                  ✅ Aceptar Invitación
                </a>
              </div>
              
              <p style="font-size: 14px; color: #666; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                O copia y pega este enlace en tu navegador:<br>
                <a href="${invitationUrl}" style="color: #10b981; word-break: break-all;">${invitationUrl}</a>
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
                <a href="https://kentra.com.mx" style="color: #10b981; text-decoration: none;">kentra.com.mx</a>
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

    console.log('✅ Developer invitation sent successfully to:', email);

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
    console.error('❌ Error in send-developer-invitation:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Error interno del servidor' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
