import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  userId: string;
  type: 'renewal_success' | 'payment_failed' | 'payment_failed_day_3' | 'payment_failed_day_5' | 'payment_failed_day_7' | 'subscription_canceled' | 'subscription_expiring' | 'downgrade_confirmed' | 'upgrade_confirmed' | 'trial_expired' | 'trial_started' | 'trial_expiring' | 'subscription_suspended' | 'welcome_paid' | 'upsell_expired' | 'renewal_reminder';
  metadata?: Record<string, any>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
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
        console.warn('Unauthorized notification attempt blocked');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { userId, type, metadata = {} }: NotificationRequest = await req.json();

    // Validate userId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!userId || !uuidRegex.test(userId)) {
      return new Response(JSON.stringify({ error: 'Invalid userId format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user details
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('name')
      .eq('id', userId)
      .single();

    const { data: authUser, error: authError } = await supabaseClient.auth.admin.getUserById(userId);

    if (authError || !authUser || !authUser.user.email) {
      console.error('Error fetching user:', authError);
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userName = profile?.name || 'Usuario';
    const userEmail = authUser.user.email;

    let subject = '';
    let htmlContent = '';

    switch (type) {
      case 'renewal_success':
        subject = '✅ Renovación exitosa - Kentra';
        htmlContent = `
          <h1>¡Renovación exitosa!</h1>
          <p>Hola ${userName},</p>
          <p>Tu suscripción se ha renovado exitosamente.</p>
          <p><strong>Plan:</strong> ${metadata.planName}</p>
          <p><strong>Monto:</strong> $${metadata.amount} MXN</p>
          <p><strong>Próxima renovación:</strong> ${metadata.nextBillingDate}</p>
          <p>Gracias por confiar en Kentra.</p>
        `;
        break;

      case 'payment_failed':
        subject = '⚠️ Pago fallido - Acción requerida';
        htmlContent = `
          <h1>Pago fallido</h1>
          <p>Hola ${userName},</p>
          <p>No pudimos procesar tu pago de suscripción.</p>
          <p><strong>Plan:</strong> ${metadata.planName}</p>
          <p><strong>Monto:</strong> $${metadata.amount} MXN</p>
          <p><strong>⏰ Tienes ${metadata.graceDaysRemaining} días para actualizar tu método de pago</strong> antes de que tu cuenta sea suspendida.</p>
          <p>Por favor, actualiza tu método de pago para continuar disfrutando de nuestros servicios sin interrupciones.</p>
          <p><a href="https://kentra.com.mx/perfil?tab=subscription" style="background-color: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Actualizar método de pago</a></p>
        `;
        break;

      case 'payment_failed_day_3':
        subject = '⚠️ Recordatorio: Actualiza tu método de pago - Kentra';
        htmlContent = `
          <h1>⚠️ Recordatorio de pago pendiente</h1>
          <p>Hola ${userName},</p>
          <p>Te recordamos que intentamos procesar el pago de tu suscripción <strong>${metadata.planName}</strong> hace ${metadata.daysSinceFailed} días sin éxito.</p>
          
          <p>⏰ <strong>Te quedan ${metadata.daysRemaining} días</strong> para actualizar tu método de pago antes de que tu suscripción sea suspendida.</p>
          
          <h2>📌 Actualiza tu método de pago ahora</h2>
          <p>Ve a tu panel de usuario y actualiza tu tarjeta para evitar la suspensión de tu cuenta.</p>
          
          <p><a href="https://kentra.com.mx/perfil?tab=subscription" style="background-color: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Actualizar Método de Pago</a></p>
          
          <p>Si ya actualizaste tu método de pago, puedes ignorar este mensaje.</p>
          
          <p>Saludos,<br>El equipo de Kentra</p>
        `;
        break;

      case 'payment_failed_day_5':
        subject = '🚨 Urgente: Solo te quedan 2 días - Actualiza tu pago en Kentra';
        htmlContent = `
          <h1>🚨 Acción requerida: Solo quedan 2 días</h1>
          <p>Hola ${userName},</p>
          <p>Tu suscripción <strong>${metadata.planName}</strong> está en riesgo de ser suspendida.</p>
          
          <p>⏰ <strong>Solo te quedan ${metadata.daysRemaining} días</strong> para actualizar tu método de pago.</p>
          
          <h2>⚠️ ¿Qué pasará si no actualizas tu pago?</h2>
          <ul>
            <li>Tu suscripción será suspendida</li>
            <li>Tus propiedades serán pausadas</li>
            <li>Perderás acceso a tu cuenta</li>
          </ul>
          
          <p><strong>👉 Actualiza tu método de pago ahora desde tu panel de usuario.</strong></p>
          
          <p><a href="https://kentra.com.mx/perfil?tab=subscription" style="background-color: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">ACTUALIZAR AHORA</a></p>
          
          <p>Si necesitas ayuda, contáctanos de inmediato.</p>
          
          <p>Saludos,<br>El equipo de Kentra</p>
        `;
        break;

      case 'payment_failed_day_7':
        subject = '🚨 Último aviso: Tu suscripción será suspendida hoy - Kentra';
        htmlContent = `
          <h1>🚨 ÚLTIMO AVISO: Tu suscripción será suspendida HOY</h1>
          <p>Hola ${userName},</p>
          <p>Este es tu último aviso. Tu suscripción <strong>${metadata.planName}</strong> será suspendida al final del día de hoy si no actualizas tu método de pago.</p>
          
          <h2>⚠️ Consecuencias de la suspensión:</h2>
          <ul>
            <li>✖️ Tu suscripción será cancelada</li>
            <li>✖️ Todas tus propiedades serán pausadas automáticamente</li>
            <li>✖️ Perderás acceso a tu cuenta</li>
            <li>✖️ Dejarás de recibir leads</li>
          </ul>
          
          <p><strong>⏰ ACTÚA AHORA:</strong> Ve a tu panel de usuario y actualiza tu tarjeta INMEDIATAMENTE.</p>
          
          <p><a href="https://kentra.com.mx/perfil?tab=subscription" style="background-color: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">ACTUALIZAR URGENTE</a></p>
          
          <p>Si tienes algún problema, contáctanos de urgencia.</p>
          
          <p>Saludos,<br>El equipo de Kentra</p>
        `;
        break;

      case 'subscription_canceled':
        subject = 'Suscripción cancelada - Kentra';
        htmlContent = `
          <h1>Suscripción cancelada</h1>
          <p>Hola ${userName},</p>
          <p>Tu suscripción ha sido cancelada y finalizará el ${metadata.endDate}.</p>
          <p>Puedes seguir usando todas las funciones hasta esa fecha.</p>
          <p>Si cambias de opinión, puedes reactivar tu suscripción en cualquier momento desde tu panel.</p>
          <p><a href="https://kentra.com.mx/perfil?tab=subscription">Gestionar suscripción</a></p>
        `;
        break;

      case 'subscription_expiring':
        subject = '⏰ Tu suscripción expira pronto';
        htmlContent = `
          <h1>Tu suscripción está por expirar</h1>
          <p>Hola ${userName},</p>
          <p>Tu suscripción al plan <strong>${metadata.planName}</strong> expirará en ${metadata.daysRemaining} días (${metadata.endDate}).</p>
          <p>Para continuar disfrutando de nuestros servicios, asegúrate de que tu método de pago esté actualizado.</p>
          <p><a href="https://kentra.com.mx/perfil?tab=subscription">Ver mi suscripción</a></p>
        `;
        break;

      case 'downgrade_confirmed':
        subject = 'Cambio de plan confirmado - Kentra';
        htmlContent = `
          <h1>Cambio de plan confirmado</h1>
          <p>Hola ${userName},</p>
          <p>Tu cambio de plan se ha procesado exitosamente.</p>
          <p><strong>Plan anterior:</strong> ${metadata.previousPlan}</p>
          <p><strong>Nuevo plan:</strong> ${metadata.newPlan}</p>
          <p><strong>Efectivo desde:</strong> ${metadata.effectiveDate}</p>
          ${metadata.propertiesRemoved > 0 ? `<p><strong>⚠️ Propiedades pausadas:</strong> ${metadata.propertiesRemoved} propiedades fueron pausadas porque exceden el límite de tu nuevo plan.</p>` : ''}
          ${metadata.featuredRemoved > 0 ? `<p><strong>⚠️ Destacadas removidas:</strong> ${metadata.featuredRemoved} propiedades destacadas fueron desactivadas. Tu nuevo plan incluye hasta ${metadata.newFeaturedLimit} destacadas por mes.</p>` : ''}
          <p><a href="https://kentra.com.mx/panel-agente">Ir a mi panel</a></p>
        `;
        break;

      case 'trial_started':
        subject = '🎉 ¡Bienvenido a tu prueba gratuita de 14 días! - Kentra';
        htmlContent = `
          <h1>¡Tu período de prueba ha comenzado! 🎉</h1>
          <p>Hola ${userName},</p>
          <p>¡Bienvenido a Kentra! Tu período de prueba gratuito de <strong>14 días</strong> comienza ahora.</p>
          
          <h2>¿Qué incluye tu prueba?</h2>
          <ul>
            <li>✅ Publica hasta <strong>1 propiedad</strong></li>
            <li>✅ Aparece en búsquedas de compradores</li>
            <li>✅ Recibe leads directos a tu WhatsApp</li>
            <li>✅ Crea tu perfil profesional</li>
          </ul>
          
          <p><strong>⏰ Tu prueba expira el:</strong> ${metadata.expiryDate}</p>
          
          <p>Después de estos ${metadata.trialDays} días, podrás elegir el plan perfecto para hacer crecer tu negocio inmobiliario.</p>
          
          <p><a href="https://kentra.com.mx/panel-agente?tab=form" style="background-color: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Publicar mi primera propiedad</a></p>
          
          <p>Si tienes alguna pregunta, estamos aquí para ayudarte.</p>
          <p>¡Mucho éxito! 🚀<br>Equipo Kentra</p>
        `;
        break;

      case 'trial_expired':
        subject = '⏰ Tu período de prueba ha finalizado - Kentra';
        htmlContent = `
          <h1>Tu período de prueba de 14 días ha finalizado</h1>
          <p>Hola ${userName},</p>
          <p>Tu período de prueba gratuito en Kentra ha expirado el ${metadata.expiredDate}.</p>
          <p><strong>¿Qué significa esto?</strong></p>
          <ul>
            <li>Tus propiedades han sido pausadas temporalmente</li>
            <li>Ya no aparecerán en las búsquedas hasta que actives un plan</li>
            <li>Puedes reactivarlas en cualquier momento contratando un plan</li>
          </ul>
          <p><strong>🎯 Elige el plan perfecto para ti:</strong></p>
          <ul>
            <li><strong>Plan Start ($249/mes):</strong> Hasta 4 propiedades activas</li>
            <li><strong>Plan Pro ($599/mes):</strong> Hasta 12 propiedades + 2 destacadas/mes</li>
            <li><strong>Plan Elite ($999/mes):</strong> Hasta 30 propiedades + 6 destacadas/mes</li>
          </ul>
          <p><a href="https://kentra.com.mx/pricing-agente" style="background-color: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Ver Planes y Precios</a></p>
          <p>Si tienes alguna pregunta, estamos aquí para ayudarte.</p>
          <p>Saludos,<br>Equipo Kentra</p>
        `;
        break;

      case 'subscription_suspended':
        subject = '🚨 Suscripción suspendida por pago fallido - Kentra';
        htmlContent = `
          <h1>Tu suscripción ha sido suspendida</h1>
          <p>Hola ${userName},</p>
          <p>Después de ${metadata.daysPastDue} días sin recibir el pago, tu suscripción al plan <strong>${metadata.planName}</strong> ha sido suspendida.</p>
          
          <p><strong>⚠️ ¿Qué significa esto?</strong></p>
          <ul>
            <li>Todas tus propiedades han sido pausadas</li>
            <li>Ya no aparecen en búsquedas</li>
            <li>No puedes publicar nuevas propiedades</li>
          </ul>
          
          <p><strong>✅ ¿Cómo reactivar tu cuenta?</strong></p>
          <ol>
            <li>Actualiza tu método de pago</li>
            <li>Tu suscripción se reactivará automáticamente</li>
            <li>Tus propiedades volverán a estar visibles</li>
          </ol>
          
          <p><a href="https://kentra.com.mx/perfil?tab=subscription" style="background-color: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Actualizar Método de Pago</a></p>
          
          <p>Si tienes alguna pregunta sobre tu cuenta, contáctanos.</p>
          <p>Equipo Kentra</p>
        `;
        break;

      // === NUEVOS EMAILS ===
      
      case 'welcome_paid':
        subject = '🎉 ¡Bienvenido a Kentra! Tu suscripción está activa';
        htmlContent = `
          <h1>¡Bienvenido a Kentra! 🎉</h1>
          <p>Hola ${userName},</p>
          <p>¡Felicidades! Tu suscripción al plan <strong>${metadata.planName}</strong> está activa.</p>
          
          <h2>📦 Tu plan incluye:</h2>
          <ul>
            <li>✅ Hasta <strong>${metadata.maxProperties}</strong> propiedades activas</li>
            <li>✅ <strong>${metadata.featuredPerMonth}</strong> propiedades destacadas por mes</li>
            <li>✅ Perfil profesional verificado</li>
            <li>✅ Leads directos a tu WhatsApp</li>
            <li>✅ Estadísticas de rendimiento</li>
          </ul>
          
          <p><strong>💳 Próxima renovación:</strong> ${metadata.nextBillingDate}</p>
          
          <p><a href="https://kentra.com.mx/panel-agente?tab=form" style="background-color: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Publicar mi primera propiedad</a></p>
          
          <p>Si tienes alguna pregunta, estamos aquí para ayudarte.</p>
          <p>¡Mucho éxito! 🚀<br>Equipo Kentra</p>
        `;
        break;

      case 'upgrade_confirmed':
        subject = '🚀 ¡Upgrade exitoso! Tu nuevo plan está activo - Kentra';
        htmlContent = `
          <h1>¡Tu plan ha sido mejorado! 🚀</h1>
          <p>Hola ${userName},</p>
          <p>Tu upgrade se ha procesado exitosamente.</p>
          
          <p><strong>Plan anterior:</strong> ${metadata.previousPlan}</p>
          <p><strong>Nuevo plan:</strong> ${metadata.newPlan}</p>
          <p><strong>Efectivo desde:</strong> ${metadata.effectiveDate}</p>
          
          <h2>🎁 Ahora tienes acceso a:</h2>
          <ul>
            <li>✅ Hasta <strong>${metadata.newMaxProperties}</strong> propiedades activas</li>
            <li>✅ <strong>${metadata.newFeaturedLimit}</strong> propiedades destacadas por mes</li>
            ${metadata.additionalFeatures ? `<li>✅ ${metadata.additionalFeatures}</li>` : ''}
          </ul>
          
          <p><a href="https://kentra.com.mx/panel-agente" style="background-color: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Ir a mi panel</a></p>
          
          <p>Gracias por confiar en Kentra.</p>
          <p>Equipo Kentra</p>
        `;
        break;

      case 'upsell_expired':
        subject = '⏰ Tu servicio adicional ha expirado - Kentra';
        htmlContent = `
          <h1>Tu servicio adicional ha expirado</h1>
          <p>Hola ${userName},</p>
          <p>Tu servicio <strong>${metadata.upsellName}</strong> ha expirado el ${metadata.expiredDate}.</p>
          
          <h3>¿Qué significa esto?</h3>
          <ul>
            <li>El beneficio ya no está activo</li>
            <li>Puedes renovarlo en cualquier momento</li>
          </ul>
          
          <a href="https://kentra.com.mx/panel-agente?tab=services" style="background-color: #616652; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">
            Renovar Servicio
          </a>
          
          <p>Si tienes alguna pregunta, estamos aquí para ayudarte.</p>
          <p>Equipo Kentra</p>
        `;
        break;

      case 'trial_expiring':
        subject = '⏰ Tu prueba gratuita expira en ${metadata.daysRemaining} días - Kentra';
        htmlContent = `
          <h1>Tu prueba gratuita está por terminar ⏰</h1>
          <p>Hola ${userName},</p>
          <p>Tu período de prueba gratuito expira en <strong>${metadata.daysRemaining} días</strong> (${metadata.expiryDate}).</p>
          
          <h2>⚠️ ¿Qué pasará cuando expire?</h2>
          <ul>
            <li>Tus propiedades serán pausadas automáticamente</li>
            <li>Ya no aparecerán en las búsquedas</li>
            <li>Dejarás de recibir leads</li>
          </ul>
          
          <h2>🎯 Elige un plan ahora y no pierdas impulso:</h2>
          <ul>
            <li><strong>Plan Start ($249/mes):</strong> Hasta 4 propiedades</li>
            <li><strong>Plan Pro ($599/mes):</strong> Hasta 12 propiedades + 2 destacadas/mes</li>
            <li><strong>Plan Elite ($999/mes):</strong> Hasta 30 propiedades + 6 destacadas/mes</li>
          </ul>
          
          <p><a href="https://kentra.com.mx/pricing-agente" style="background-color: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Ver Planes y Precios</a></p>
          
          <p>Si tienes alguna pregunta, estamos aquí para ayudarte.</p>
          <p>Saludos,<br>Equipo Kentra</p>
        `;
        break;

      case 'renewal_reminder':
        subject = '📅 Tu suscripción se renueva en 3 días - Kentra';
        htmlContent = `
          <h1>Recordatorio de Renovación</h1>
          <p>Hola ${userName},</p>
          <p>Te recordamos que tu suscripción al plan <strong>${metadata.planName}</strong> se renovará automáticamente el <strong>${metadata.renewalDate}</strong>.</p>
          
          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 8px 0;"><strong>Plan:</strong> ${metadata.planName}</p>
            <p style="margin: 8px 0;"><strong>Monto:</strong> $${metadata.amount} ${metadata.currency}/${metadata.billingCycle || 'mes'}</p>
            <p style="margin: 8px 0;"><strong>Fecha de renovación:</strong> ${metadata.renewalDate}</p>
          </div>
          
          <p>Si deseas actualizar tu método de pago o cambiar de plan, hazlo antes de la fecha de renovación.</p>
          
          <a href="https://kentra.com.mx/panel-agente?tab=subscription" style="background-color: #616652; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">
            Administrar Suscripción
          </a>
          
          <p>Si no deseas continuar, puedes cancelar tu suscripción en cualquier momento desde tu panel.</p>
          
          <p>Gracias por ser parte de Kentra.</p>
          <p>Equipo Kentra</p>
        `;
        break;

      default:
        return new Response(JSON.stringify({ error: 'Invalid notification type' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const emailResponse = await resend.emails.send({
      from: 'Kentra <noreply@updates.kentra.com.mx>',
      to: [userEmail],
      subject,
      html: htmlContent,
    });

    console.log('Notification sent:', { type, userId, emailResponse });

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending notification:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
