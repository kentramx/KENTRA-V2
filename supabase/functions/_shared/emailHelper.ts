/**
 * Kentra Email Helper - Centralizado para mejores prácticas anti-spam
 * 
 * Este helper asegura:
 * - Versión texto plano automática
 * - Headers anti-spam (X-Entity-Ref-ID, List-Unsubscribe)
 * - Tags de categorización
 * - replyTo configurado
 * - Footer anti-spam con dirección física
 * - Logging mejorado
 */

import { Resend } from 'https://esm.sh/resend@2.0.0';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

// Configuración centralizada
const EMAIL_CONFIG = {
  fromAddress: 'Kentra <noreply@updates.kentra.com.mx>',
  replyTo: 'soporte@kentra.com.mx',
  baseUrl: 'https://kentra.com.mx',
  companyName: 'Kentra',
  companyAddress: 'Ciudad de México, México',
  unsubscribeUrl: 'https://kentra.com.mx/configuracion-notificaciones',
  socialLinks: {
    instagram: 'https://www.instagram.com/kentra.mx',
    facebook: 'https://www.facebook.com/profile.php?id=61583478575484',
  },
};

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  htmlContent: string;
  category?: 'transactional' | 'marketing';
  fromName?: string; // Permite personalizar el nombre (ej: "Kentra Admin")
  tags?: Array<{ name: string; value: string }>;
}

/**
 * Convierte HTML a texto plano básico
 */
function htmlToText(html: string): string {
  return html
    // Reemplazar <br> y </p> con saltos de línea
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    // Extraer texto de enlaces
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
    // Remover todas las etiquetas HTML restantes
    .replace(/<[^>]+>/g, '')
    // Decodificar entidades HTML comunes
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Limpiar espacios múltiples
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/  +/g, ' ')
    .trim();
}

/**
 * Genera el footer anti-spam estándar
 */
export function getAntiSpamFooter(): string {
  const year = new Date().getFullYear();
  
  return `
    <!-- Footer Anti-Spam -->
    <div style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px 0;">
        Este email fue enviado por ${EMAIL_CONFIG.companyName} porque tienes una cuenta activa.
      </p>
      <p style="color: #6b7280; font-size: 12px; margin: 0 0 12px 0;">
        <strong>${EMAIL_CONFIG.companyName}</strong> - El Marketplace Inmobiliario de México<br>
        ${EMAIL_CONFIG.companyAddress}
      </p>
      <div style="margin: 12px 0;">
        <a href="${EMAIL_CONFIG.socialLinks.instagram}" style="color: #6366f1; text-decoration: none; margin: 0 8px; font-size: 12px;">Instagram</a>
        <span style="color: #d1d5db;">|</span>
        <a href="${EMAIL_CONFIG.socialLinks.facebook}" style="color: #6366f1; text-decoration: none; margin: 0 8px; font-size: 12px;">Facebook</a>
      </div>
      <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
        <a href="${EMAIL_CONFIG.unsubscribeUrl}" style="color: #9ca3af; text-decoration: underline; font-size: 11px;">
          Administrar preferencias de email
        </a>
        <span style="color: #d1d5db; margin: 0 8px;">|</span>
        <a href="${EMAIL_CONFIG.unsubscribeUrl}" style="color: #9ca3af; text-decoration: underline; font-size: 11px;">
          Cancelar suscripción
        </a>
      </div>
      <p style="color: #9ca3af; font-size: 11px; margin: 12px 0 0 0;">
        © ${year} ${EMAIL_CONFIG.companyName}. Todos los derechos reservados.
      </p>
    </div>
  `;
}

/**
 * Envía un email con todas las mejores prácticas anti-spam
 */
export async function sendEmail({
  to,
  subject,
  htmlContent,
  category = 'transactional',
  fromName,
  tags = [],
}: SendEmailOptions): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const toArray = Array.isArray(to) ? to : [to];
    
    // Generar versión texto plano
    const textContent = htmlToText(htmlContent);
    
    // Construir from address
    const fromAddress = fromName 
      ? `${fromName} <noreply@updates.kentra.com.mx>`
      : EMAIL_CONFIG.fromAddress;
    
    // Generar ID único para el email
    const entityRefId = crypto.randomUUID();
    
    // Tags por defecto + tags personalizados
    const emailTags = [
      { name: 'category', value: category },
      { name: 'app', value: 'kentra' },
      ...tags,
    ];

    console.log(`📧 [EmailHelper] Sending ${category} email to ${toArray.join(', ')}`);
    console.log(`📧 [EmailHelper] Subject: ${subject}`);

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      reply_to: EMAIL_CONFIG.replyTo,
      to: toArray,
      subject,
      html: htmlContent,
      text: textContent, // ← CRÍTICO: Versión texto plano
      headers: {
        'X-Entity-Ref-ID': entityRefId, // Previene threading incorrecto
        'List-Unsubscribe': `<${EMAIL_CONFIG.unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      tags: emailTags,
    });

    if (error) {
      console.error(`❌ [EmailHelper] Error sending email:`, error);
      return { success: false, error: error.message };
    }

    console.log(`✅ [EmailHelper] Email sent successfully. ID: ${data?.id}`);
    return { success: true, data };

  } catch (error: any) {
    console.error(`❌ [EmailHelper] Exception sending email:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Wrapper para enviar emails con footer anti-spam incluido
 */
export async function sendEmailWithFooter(
  options: SendEmailOptions
): Promise<{ success: boolean; data?: any; error?: string }> {
  // Insertar footer antes del cierre de body si existe
  let htmlWithFooter = options.htmlContent;
  
  if (htmlWithFooter.includes('</body>')) {
    htmlWithFooter = htmlWithFooter.replace('</body>', `${getAntiSpamFooter()}</body>`);
  } else {
    // Si no hay body tag, agregar al final
    htmlWithFooter = htmlWithFooter + getAntiSpamFooter();
  }
  
  return sendEmail({
    ...options,
    htmlContent: htmlWithFooter,
  });
}

/**
 * Genera el wrapper HTML base para emails
 */
export function getEmailWrapper(content: string, headerColor: string = '#6366f1'): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    ${content}
  </div>
</body>
</html>
  `.trim();
}

/**
 * Genera un botón CTA estilizado
 */
export function getCtaButton(text: string, url: string, color: string = '#6366f1'): string {
  return `
    <div style="text-align: center; margin: 32px 0;">
      <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, ${color} 0%, ${adjustColor(color, -20)} 100%); color: white; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">
        ${text}
      </a>
    </div>
  `;
}

/**
 * Ajusta el brillo de un color hex
 */
function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

// Export config for use in other functions
export { EMAIL_CONFIG };
