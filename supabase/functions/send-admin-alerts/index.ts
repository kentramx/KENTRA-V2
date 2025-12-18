import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';
import { sendEmail, getAntiSpamFooter, EMAIL_CONFIG } from '../_shared/emailHelper.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AlertConditions {
  spike_in_failed_payments: boolean;
  spike_in_cancellations: boolean;
  webhook_failures: boolean;
  cron_job_failures: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔔 Checking for critical alerts...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const alerts: AlertConditions = {
      spike_in_failed_payments: false,
      spike_in_cancellations: false,
      webhook_failures: false,
      cron_job_failures: false,
    };

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // CHECK 1: Spike en pagos fallidos (>5 en 1 hora)
    const { count: failedPaymentsCount, error: failedPaymentsError } = await supabaseClient
      .from('payment_history')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', oneHourAgo.toISOString());

    if (failedPaymentsError) {
      console.error('Error checking failed payments:', failedPaymentsError);
    } else if (failedPaymentsCount && failedPaymentsCount > 5) {
      alerts.spike_in_failed_payments = true;
      console.log(`⚠️ ALERT: ${failedPaymentsCount} pagos fallidos en la última hora`);
    }

    // CHECK 2: Spike en cancelaciones (>3 en 1 hora)
    const { count: cancellationsCount, error: cancellationsError } = await supabaseClient
      .from('subscription_changes')
      .select('*', { count: 'exact', head: true })
      .eq('change_type', 'cancellation')
      .gte('changed_at', oneHourAgo.toISOString());

    if (cancellationsError) {
      console.error('Error checking cancellations:', cancellationsError);
    } else if (cancellationsCount && cancellationsCount > 3) {
      alerts.spike_in_cancellations = true;
      console.log(`⚠️ ALERT: ${cancellationsCount} cancelaciones en la última hora`);
    }

    // Si no hay alertas, no enviar email
    const hasAlerts = Object.values(alerts).some(alert => alert);
    
    if (!hasAlerts) {
      console.log('✅ No se detectaron alertas críticas');
      return new Response(
        JSON.stringify({ message: 'No alerts detected', alerts }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obtener emails de super admins
    const { data: superAdmins, error: adminsError } = await supabaseClient
      .from('user_roles')
      .select('user_id')
      .eq('role', 'super_admin');

    if (adminsError) {
      console.error('Error fetching super admins:', adminsError);
      throw adminsError;
    }

    const adminEmails: string[] = [];
    for (const admin of superAdmins || []) {
      const { data: userData } = await supabaseClient.auth.admin.getUserById(admin.user_id);
      if (userData?.user?.email) {
        adminEmails.push(userData.user.email);
      }
    }

    if (adminEmails.length === 0) {
      console.log('⚠️ No se encontraron emails de super admins');
      return new Response(
        JSON.stringify({ message: 'No admin emails found', alerts }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Construir mensajes de alerta
    const alertMessages = [];
    if (alerts.spike_in_failed_payments) {
      alertMessages.push(`🔴 <strong>Spike en Pagos Fallidos:</strong> ${failedPaymentsCount} pagos fallaron en la última hora`);
    }
    if (alerts.spike_in_cancellations) {
      alertMessages.push(`🟠 <strong>Spike en Cancelaciones:</strong> ${cancellationsCount} cancelaciones en la última hora`);
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">🚨 Alerta Crítica del Sistema</h1>
    </div>
    <div style="padding: 30px;">
      <p style="color: #374151; font-size: 16px;">Se han detectado condiciones críticas en el sistema de monetización:</p>
      
      ${alertMessages.map(msg => `
        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 15px 0; border-radius: 4px;">
          ${msg}
        </div>
      `).join('')}
      
      <div style="margin-top: 24px;">
        <p style="color: #374151; font-weight: bold;">Acciones recomendadas:</p>
        <ul style="color: #374151;">
          <li>Revisa el panel de Salud del Sistema</li>
          <li>Verifica el estado de los webhooks de Stripe</li>
          <li>Contacta a usuarios afectados si es necesario</li>
        </ul>
      </div>
      
      <div style="text-align: center; margin: 24px 0;">
        <a href="${EMAIL_CONFIG.baseUrl}/admin/system-health" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Ver Panel de Salud del Sistema</a>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
        Este es un email automático del sistema de monitoreo de Kentra.<br>
        Fecha: ${now.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}
      </p>
    </div>
    ${getAntiSpamFooter()}
  </div>
</body>
</html>
    `;

    // Enviar email a todos los super admins
    for (const email of adminEmails) {
      const result = await sendEmail({
        to: email,
        subject: '🚨 Alerta Crítica - Sistema de Monetización',
        htmlContent: html,
        category: 'transactional',
        fromName: 'Kentra Alertas',
        tags: [{ name: 'alert_type', value: 'system_critical' }],
      });

      if (result.success) {
        console.log(`✅ Email de alerta enviado a ${email}`);
      } else {
        console.error(`❌ Error enviando a ${email}:`, result.error);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        alerts,
        emails_sent: adminEmails.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-admin-alerts:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to send admin alerts', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
