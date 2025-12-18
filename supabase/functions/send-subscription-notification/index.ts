import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';
import { createLogger } from '../_shared/logger.ts';
import { sendEmail, getAntiSpamFooter, EMAIL_CONFIG } from '../_shared/emailHelper.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  userId: string;
  type: 'renewal_success' | 'payment_failed' | 'payment_failed_day_3' | 'payment_failed_day_5' | 'payment_failed_day_7' | 'subscription_canceled' | 'subscription_expiring' | 'downgrade_confirmed' | 'upgrade_confirmed' | 'trial_expired' | 'trial_started' | 'trial_expiring' | 'subscription_suspended' | 'welcome_paid' | 'upsell_expired' | 'renewal_reminder';
  metadata?: Record<string, any>;
}

const BASE_URL = EMAIL_CONFIG.baseUrl;

Deno.serve(async (req) => {
  const logger = createLogger('send-subscription-notification');
  let requestUserId = '';
  let requestType = '';

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Security: Verify internal service token to prevent unauthorized calls
    const authHeader = req.headers.get('Authorization');
    const internalToken = Deno.env.get('INTERNAL_SERVICE_TOKEN');
    
    if (internalToken && authHeader !== `Bearer ${internalToken}`) {
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
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { userId, type, metadata = {} }: NotificationRequest = await req.json();
    requestUserId = userId;
    requestType = type;

    // Validate userId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!userId || !uuidRegex.test(userId)) {
      return new Response(JSON.stringify({ error: 'Invalid userId format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user details
    const { data: profile } = await supabaseClient
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

    // Template base wrapper
    const wrapContent = (headerBg: string, headerTitle: string, bodyContent: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: ${headerBg}; padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">${headerTitle}</h1>
    </div>
    <div style="padding: 30px;">
      ${bodyContent}
    </div>
    ${getAntiSpamFooter()}
  </div>
</body>
</html>`;

    switch (type) {
      case 'renewal_success':
        subject = '✅ Renovación exitosa - Kentra';
        htmlContent = wrapContent(
          'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          '✅ ¡Renovación exitosa!',
          `
            <p style="color: #374151; font-size: 16px;">Hola ${userName},</p>
            <p style="color: #374151; font-size: 16px;">Tu suscripción se ha renovado exitosamente.</p>
            <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 8px 0;"><strong>Plan:</strong> ${metadata.planName}</p>
              <p style="margin: 8px 0;"><strong>Monto:</strong> $${metadata.amount} MXN</p>
              <p style="margin: 8px 0;"><strong>Próxima renovación:</strong> ${metadata.nextBillingDate}</p>
            </div>
            <p style="color: #374151;">Gracias por confiar en Kentra.</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${BASE_URL}/panel-agente" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Ver mi panel</a>
            </div>
          `
        );
        break;

      case 'payment_failed':
        subject = '⚠️ Pago fallido - Acción requerida';
        htmlContent = wrapContent(
          'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
          '⚠️ Pago fallido',
          `
            <p style="color: #374151; font-size: 16px;">Hola ${userName},</p>
            <p style="color: #374151; font-size: 16px;">No pudimos procesar tu pago de suscripción.</p>
            <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #DC2626;">
              <p style="margin: 8px 0;"><strong>Plan:</strong> ${metadata.planName}</p>
              <p style="margin: 8px 0;"><strong>Monto:</strong> $${metadata.amount} MXN</p>
              <p style="margin: 8px 0; color: #DC2626;"><strong>⏰ Tienes ${metadata.graceDaysRemaining} días para actualizar tu método de pago</strong></p>
            </div>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${BASE_URL}/perfil?tab=subscription" style="background: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Actualizar método de pago</a>
            </div>
          `
        );
        break;

      case 'payment_failed_day_3':
        subject = '⚠️ Recordatorio: Actualiza tu método de pago - Kentra';
        htmlContent = wrapContent(
          'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          '⚠️ Recordatorio de pago pendiente',
          `
            <p style="color: #374151; font-size: 16px;">Hola ${userName},</p>
            <p style="color: #374151; font-size: 16px;">Te recordamos que intentamos procesar el pago de tu suscripción <strong>${metadata.planName}</strong> hace ${metadata.daysSinceFailed} días sin éxito.</p>
            <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <p style="margin: 0; color: #92400e;"><strong>⏰ Te quedan ${metadata.daysRemaining} días</strong> para actualizar tu método de pago antes de que tu suscripción sea suspendida.</p>
            </div>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${BASE_URL}/perfil?tab=subscription" style="background: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Actualizar Método de Pago</a>
            </div>
          `
        );
        break;

      case 'payment_failed_day_5':
        subject = '🚨 Urgente: Solo te quedan 2 días - Actualiza tu pago en Kentra';
        htmlContent = wrapContent(
          'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
          '🚨 Solo quedan 2 días',
          `
            <p style="color: #374151; font-size: 16px;">Hola ${userName},</p>
            <p style="color: #374151; font-size: 16px;">Tu suscripción <strong>${metadata.planName}</strong> está en riesgo de ser suspendida.</p>
            <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 12px 0; color: #DC2626; font-weight: bold;">⏰ Solo te quedan ${metadata.daysRemaining} días</p>
              <p style="margin: 0; color: #7f1d1d;"><strong>¿Qué pasará si no actualizas?</strong></p>
              <ul style="color: #7f1d1d; margin: 8px 0;">
                <li>Tu suscripción será suspendida</li>
                <li>Tus propiedades serán pausadas</li>
                <li>Perderás acceso a tu cuenta</li>
              </ul>
            </div>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${BASE_URL}/perfil?tab=subscription" style="background: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">ACTUALIZAR AHORA</a>
            </div>
          `
        );
        break;

      case 'payment_failed_day_7':
        subject = '🚨 Último aviso: Tu suscripción será suspendida hoy - Kentra';
        htmlContent = wrapContent(
          'linear-gradient(135deg, #7f1d1d 0%, #450a0a 100%)',
          '🚨 ÚLTIMO AVISO',
          `
            <p style="color: #374151; font-size: 16px;">Hola ${userName},</p>
            <p style="color: #374151; font-size: 16px;"><strong>Este es tu último aviso.</strong> Tu suscripción <strong>${metadata.planName}</strong> será suspendida al final del día de hoy.</p>
            <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #DC2626;">
              <p style="margin: 0 0 12px 0; color: #DC2626; font-weight: bold;">Consecuencias de la suspensión:</p>
              <ul style="color: #7f1d1d; margin: 8px 0;">
                <li>✖️ Tu suscripción será cancelada</li>
                <li>✖️ Todas tus propiedades serán pausadas</li>
                <li>✖️ Perderás acceso a tu cuenta</li>
                <li>✖️ Dejarás de recibir leads</li>
              </ul>
            </div>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${BASE_URL}/perfil?tab=subscription" style="background: #DC2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 18px;">ACTUALIZAR URGENTE</a>
            </div>
          `
        );
        break;

      case 'subscription_canceled':
        subject = 'Suscripción cancelada - Kentra';
        htmlContent = wrapContent(
          'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
          'Suscripción cancelada',
          `
            <p style="color: #374151; font-size: 16px;">Hola ${userName},</p>
            <p style="color: #374151; font-size: 16px;">Tu suscripción ha sido cancelada y finalizará el <strong>${metadata.endDate}</strong>.</p>
            <p style="color: #374151; font-size: 16px;">Puedes seguir usando todas las funciones hasta esa fecha.</p>
            <p style="color: #374151; font-size: 16px;">Si cambias de opinión, puedes reactivar tu suscripción en cualquier momento.</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${BASE_URL}/perfil?tab=subscription" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Gestionar suscripción</a>
            </div>
          `
        );
        break;

      case 'trial_started':
        subject = '🎉 ¡Bienvenido a tu prueba gratuita de 14 días! - Kentra';
        htmlContent = wrapContent(
          'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)',
          '🎉 ¡Tu período de prueba ha comenzado!',
          `
            <p style="color: #374151; font-size: 16px;">Hola ${userName},</p>
            <p style="color: #374151; font-size: 16px;">¡Bienvenido a Kentra! Tu período de prueba gratuito de <strong>14 días</strong> comienza ahora.</p>
            <div style="background: #f5f3ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 12px 0; font-weight: bold; color: #5B21B6;">¿Qué incluye tu prueba?</p>
              <ul style="color: #374151; margin: 8px 0;">
                <li>✅ Publica hasta <strong>1 propiedad</strong></li>
                <li>✅ Aparece en búsquedas de compradores</li>
                <li>✅ Recibe leads directos a tu WhatsApp</li>
                <li>✅ Crea tu perfil profesional</li>
              </ul>
              <p style="margin: 12px 0 0 0; color: #5B21B6;"><strong>⏰ Tu prueba expira el:</strong> ${metadata.expiryDate}</p>
            </div>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${BASE_URL}/panel-agente?tab=form" style="background: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Publicar mi primera propiedad</a>
            </div>
            <p style="color: #374151; text-align: center;">¡Mucho éxito! 🚀</p>
          `
        );
        break;

      case 'trial_expired':
        subject = '⏰ Tu período de prueba ha finalizado - Kentra';
        htmlContent = wrapContent(
          'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          '⏰ Tu prueba ha finalizado',
          `
            <p style="color: #374151; font-size: 16px;">Hola ${userName},</p>
            <p style="color: #374151; font-size: 16px;">Tu período de prueba gratuito en Kentra ha expirado el <strong>${metadata.expiredDate}</strong>.</p>
            <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <p style="margin: 0 0 12px 0; font-weight: bold; color: #92400e;">¿Qué significa esto?</p>
              <ul style="color: #78350f; margin: 8px 0;">
                <li>Tus propiedades han sido pausadas temporalmente</li>
                <li>Ya no aparecerán en las búsquedas</li>
                <li>Puedes reactivarlas contratando un plan</li>
              </ul>
            </div>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${BASE_URL}/pricing-agente" style="background: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Ver Planes y Precios</a>
            </div>
          `
        );
        break;

      case 'subscription_suspended':
        subject = '🚨 Suscripción suspendida por pago fallido - Kentra';
        htmlContent = wrapContent(
          'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
          '🚨 Suscripción suspendida',
          `
            <p style="color: #374151; font-size: 16px;">Hola ${userName},</p>
            <p style="color: #374151; font-size: 16px;">Después de ${metadata.daysPastDue} días sin recibir el pago, tu suscripción al plan <strong>${metadata.planName}</strong> ha sido suspendida.</p>
            <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 12px 0; font-weight: bold; color: #DC2626;">⚠️ ¿Qué significa esto?</p>
              <ul style="color: #7f1d1d; margin: 8px 0;">
                <li>Todas tus propiedades han sido pausadas</li>
                <li>Ya no aparecen en búsquedas</li>
                <li>No puedes publicar nuevas propiedades</li>
              </ul>
            </div>
            <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 12px 0; font-weight: bold; color: #059669;">✅ ¿Cómo reactivar tu cuenta?</p>
              <ol style="color: #065f46; margin: 8px 0;">
                <li>Actualiza tu método de pago</li>
                <li>Tu suscripción se reactivará automáticamente</li>
                <li>Tus propiedades volverán a estar visibles</li>
              </ol>
            </div>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${BASE_URL}/perfil?tab=subscription" style="background: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Actualizar Método de Pago</a>
            </div>
          `
        );
        break;

      case 'welcome_paid':
        subject = '🎉 ¡Bienvenido a Kentra! Tu suscripción está activa';
        htmlContent = wrapContent(
          'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)',
          '🎉 ¡Bienvenido a Kentra!',
          `
            <p style="color: #374151; font-size: 16px;">Hola ${userName},</p>
            <p style="color: #374151; font-size: 16px;">¡Felicidades! Tu suscripción al plan <strong>${metadata.planName}</strong> está activa.</p>
            <div style="background: #f5f3ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 12px 0; font-weight: bold; color: #5B21B6;">📦 Tu plan incluye:</p>
              <ul style="color: #374151; margin: 8px 0;">
                <li>✅ Hasta <strong>${metadata.maxProperties}</strong> propiedades activas</li>
                <li>✅ <strong>${metadata.featuredPerMonth}</strong> propiedades destacadas por mes</li>
                <li>✅ Perfil profesional verificado</li>
                <li>✅ Leads directos a tu WhatsApp</li>
                <li>✅ Estadísticas de rendimiento</li>
              </ul>
              <p style="margin: 12px 0 0 0; color: #5B21B6;"><strong>💳 Próxima renovación:</strong> ${metadata.nextBillingDate}</p>
            </div>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${BASE_URL}/panel-agente?tab=form" style="background: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Publicar mi primera propiedad</a>
            </div>
            <p style="color: #374151; text-align: center;">¡Mucho éxito! 🚀</p>
          `
        );
        break;

      case 'upgrade_confirmed':
        subject = '🚀 ¡Upgrade exitoso! Tu nuevo plan está activo - Kentra';
        htmlContent = wrapContent(
          'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          '🚀 ¡Tu plan ha sido mejorado!',
          `
            <p style="color: #374151; font-size: 16px;">Hola ${userName},</p>
            <p style="color: #374151; font-size: 16px;">Tu upgrade se ha procesado exitosamente.</p>
            <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 8px 0;"><strong>Plan anterior:</strong> ${metadata.previousPlan}</p>
              <p style="margin: 8px 0;"><strong>Nuevo plan:</strong> ${metadata.newPlan}</p>
              <p style="margin: 8px 0;"><strong>Efectivo desde:</strong> ${metadata.effectiveDate}</p>
            </div>
            <div style="background: #f5f3ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 12px 0; font-weight: bold; color: #5B21B6;">🎁 Ahora tienes acceso a:</p>
              <ul style="color: #374151; margin: 8px 0;">
                <li>✅ Hasta <strong>${metadata.newMaxProperties}</strong> propiedades activas</li>
                <li>✅ <strong>${metadata.newFeaturedLimit}</strong> propiedades destacadas por mes</li>
                ${metadata.additionalFeatures ? `<li>✅ ${metadata.additionalFeatures}</li>` : ''}
              </ul>
            </div>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${BASE_URL}/panel-agente" style="background: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Ir a mi panel</a>
            </div>
          `
        );
        break;

      case 'downgrade_confirmed':
        subject = 'Cambio de plan confirmado - Kentra';
        htmlContent = wrapContent(
          'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
          'Cambio de plan confirmado',
          `
            <p style="color: #374151; font-size: 16px;">Hola ${userName},</p>
            <p style="color: #374151; font-size: 16px;">Tu cambio de plan se ha procesado exitosamente.</p>
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 8px 0;"><strong>Plan anterior:</strong> ${metadata.previousPlan}</p>
              <p style="margin: 8px 0;"><strong>Nuevo plan:</strong> ${metadata.newPlan}</p>
              <p style="margin: 8px 0;"><strong>Efectivo desde:</strong> ${metadata.effectiveDate}</p>
            </div>
            ${metadata.propertiesRemoved > 0 ? `
              <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                <p style="margin: 0; color: #92400e;"><strong>⚠️ Propiedades pausadas:</strong> ${metadata.propertiesRemoved} propiedades fueron pausadas porque exceden el límite de tu nuevo plan.</p>
              </div>
            ` : ''}
            <div style="text-align: center; margin: 24px 0;">
              <a href="${BASE_URL}/panel-agente" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Ir a mi panel</a>
            </div>
          `
        );
        break;

      case 'upsell_expired':
        subject = '⏰ Tu servicio adicional ha expirado - Kentra';
        htmlContent = wrapContent(
          'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          '⏰ Servicio expirado',
          `
            <p style="color: #374151; font-size: 16px;">Hola ${userName},</p>
            <p style="color: #374151; font-size: 16px;">Tu servicio <strong>${metadata.upsellName}</strong> ha expirado el ${metadata.expiredDate}.</p>
            <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 12px 0; font-weight: bold; color: #92400e;">¿Qué significa esto?</p>
              <ul style="color: #78350f; margin: 8px 0;">
                <li>El beneficio ya no está activo</li>
                <li>Puedes renovarlo cuando lo necesites</li>
              </ul>
            </div>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${BASE_URL}/panel-agente?tab=upsells" style="background: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Renovar servicio</a>
            </div>
          `
        );
        break;

      case 'renewal_reminder':
        subject = '⏰ Tu suscripción se renovará pronto - Kentra';
        htmlContent = wrapContent(
          'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
          '⏰ Recordatorio de renovación',
          `
            <p style="color: #374151; font-size: 16px;">Hola ${userName},</p>
            <p style="color: #374151; font-size: 16px;">Te recordamos que tu suscripción se renovará pronto.</p>
            <div style="background: #f5f3ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 8px 0;"><strong>Plan:</strong> ${metadata.planName}</p>
              <p style="margin: 8px 0;"><strong>Monto:</strong> $${metadata.amount} MXN</p>
              <p style="margin: 8px 0;"><strong>Fecha de renovación:</strong> ${metadata.renewalDate}</p>
            </div>
            <p style="color: #374151; font-size: 16px;">Asegúrate de que tu método de pago esté actualizado para evitar interrupciones.</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${BASE_URL}/perfil?tab=subscription" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Ver mi suscripción</a>
            </div>
          `
        );
        break;

      case 'trial_expiring':
      case 'subscription_expiring':
        subject = '⏰ Tu suscripción expira pronto - Kentra';
        htmlContent = wrapContent(
          'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          '⏰ Tu suscripción expira pronto',
          `
            <p style="color: #374151; font-size: 16px;">Hola ${userName},</p>
            <p style="color: #374151; font-size: 16px;">Tu suscripción al plan <strong>${metadata.planName}</strong> expirará en ${metadata.daysRemaining} días (${metadata.endDate}).</p>
            <p style="color: #374151; font-size: 16px;">Para continuar disfrutando de nuestros servicios, asegúrate de que tu método de pago esté actualizado.</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${BASE_URL}/perfil?tab=subscription" style="background: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Ver mi suscripción</a>
            </div>
          `
        );
        break;

      default:
        console.error('Unknown notification type:', type);
        return new Response(JSON.stringify({ error: 'Unknown notification type' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // Send email using centralized helper
    const emailResult = await sendEmail({
      to: userEmail,
      subject,
      htmlContent,
      category: 'transactional',
      tags: [
        { name: 'notification_type', value: type },
        { name: 'user_id', value: userId },
      ],
    });

    if (!emailResult.success) {
      throw new Error(emailResult.error || 'Failed to send email');
    }

    logger.info('Subscription notification sent', {
      userId: requestUserId,
      action: requestType,
    });

    return new Response(
      JSON.stringify({ success: true, emailId: emailResult.data?.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    logger.error('Error sending subscription notification', {
      userId: requestUserId,
      action: requestType,
      error: error.message,
    });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
