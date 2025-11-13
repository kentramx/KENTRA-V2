import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';
import { Resend } from 'npm:resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

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

    // Construir HTML del email
    const alertMessages = [];
    if (alerts.spike_in_failed_payments) {
      alertMessages.push(`🔴 <strong>Spike en Pagos Fallidos:</strong> ${failedPaymentsCount} pagos fallaron en la última hora`);
    }
    if (alerts.spike_in_cancellations) {
      alertMessages.push(`🟠 <strong>Spike en Cancelaciones:</strong> ${cancellationsCount} cancelaciones en la última hora`);
    }
    if (alerts.webhook_failures) {
      alertMessages.push(`⚠️ <strong>Webhook de Stripe Caído:</strong> No se han recibido eventos en las últimas 2 horas`);
    }
    if (alerts.cron_job_failures) {
      alertMessages.push(`⚠️ <strong>Cron Jobs Fallando:</strong> Detectados fallos en jobs automáticos`);
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ef4444; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
          .alert { background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 15px 0; border-radius: 4px; }
          .button { display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">🚨 Alerta Crítica del Sistema</h1>
          </div>
          <div class="content">
            <p>Se han detectado condiciones críticas en el sistema de monetización que requieren tu atención inmediata:</p>
            
            ${alertMessages.map(msg => `<div class="alert">${msg}</div>`).join('')}
            
            <p style="margin-top: 30px;">
              <strong>Acciones recomendadas:</strong>
            </p>
            <ul>
              <li>Revisa el panel de Salud del Sistema</li>
              <li>Verifica el estado de los webhooks de Stripe</li>
              <li>Contacta a usuarios afectados si es necesario</li>
            </ul>
            
            <a href="https://kentra.com.mx/admin/system-health" class="button">
              Ver Panel de Salud del Sistema
            </a>
            
            <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
              Este es un email automático del sistema de monitoreo de Kentra.<br>
              Fecha: ${now.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Enviar email a todos los super admins
    for (const email of adminEmails) {
      await resend.emails.send({
        from: 'Kentra Alerts <noreply@updates.kentra.com.mx>',
        to: [email],
        subject: '🚨 Alerta Crítica - Sistema de Monetización',
        html: html,
      });
      console.log(`✅ Email de alerta enviado a ${email}`);
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
