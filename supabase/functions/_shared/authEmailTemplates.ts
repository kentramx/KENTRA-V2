/**
 * Templates de email para autenticación con branding de Kentra
 * Usados por send-auth-verification-email y send-auth-recovery-email
 */

import { getAntiSpamFooter, EMAIL_CONFIG } from './emailHelper.ts';

const KENTRA_LOGO_URL = 'https://kentra.com.mx/lovable-uploads/6be6f79c-b746-4361-aa72-c6a4c6e7ff41.png';
const PRIMARY_COLOR = '#6366f1';
const PRIMARY_DARK = '#4f46e5';

/**
 * Template base para emails de autenticación
 */
function getAuthEmailWrapper(content: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Kentra</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f3f4f6; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
    ${content}
  </div>
</body>
</html>
  `.trim();
}

/**
 * Header con logo de Kentra
 */
function getEmailHeader(): string {
  return `
    <div style="background: linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${PRIMARY_DARK} 100%); padding: 32px; text-align: center;">
      <img src="${KENTRA_LOGO_URL}" alt="Kentra" style="height: 48px; width: auto;" />
    </div>
  `;
}

/**
 * Email de verificación de cuenta con código de 6 dígitos
 */
export function getVerificationEmailHtml(params: {
  userName: string;
  verificationCode: string;
  expiresInHours: number;
}): string {
  const { userName, verificationCode, expiresInHours } = params;
  
  const content = `
    ${getEmailHeader()}
    
    <div style="padding: 40px 32px;">
      <h1 style="color: #111827; font-size: 24px; font-weight: 700; margin: 0 0 16px 0; text-align: center;">
        ¡Bienvenido a Kentra!
      </h1>
      
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">
        Hola${userName ? ` <strong>${userName}</strong>` : ''}, gracias por registrarte en Kentra, el marketplace inmobiliario de México.
      </p>
      
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">
        Para verificar tu cuenta, ingresa el siguiente código:
      </p>
      
      <div style="background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); border: 2px solid #e5e7eb; border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 24px 0;">
        <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: ${PRIMARY_COLOR}; font-family: 'Courier New', monospace;">
          ${verificationCode}
        </div>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 0 0 24px 0; text-align: center;">
        Este código expira en <strong>${expiresInHours} horas</strong>.
      </p>
      
      <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 24px;">
        <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; margin: 0; text-align: center;">
          Si no creaste una cuenta en Kentra, puedes ignorar este email de forma segura.
        </p>
      </div>
    </div>
    
    ${getAntiSpamFooter()}
  `;
  
  return getAuthEmailWrapper(content);
}

/**
 * Versión texto plano del email de verificación
 */
export function getVerificationEmailText(params: {
  userName: string;
  verificationCode: string;
  expiresInHours: number;
}): string {
  const { userName, verificationCode, expiresInHours } = params;
  
  return `
¡Bienvenido a Kentra!

Hola${userName ? ` ${userName}` : ''}, gracias por registrarte en Kentra, el marketplace inmobiliario de México.

Para verificar tu cuenta, ingresa el siguiente código:

${verificationCode}

Este código expira en ${expiresInHours} horas.

Si no creaste una cuenta en Kentra, puedes ignorar este email de forma segura.

---
Este email fue enviado por Kentra porque tienes una cuenta activa.
Kentra - El Marketplace Inmobiliario de México
Ciudad de México, México

Instagram: ${EMAIL_CONFIG.socialLinks.instagram}
Facebook: ${EMAIL_CONFIG.socialLinks.facebook}

Administrar preferencias: ${EMAIL_CONFIG.unsubscribeUrl}
  `.trim();
}

/**
 * Email de recuperación de contraseña con link
 */
export function getRecoveryEmailHtml(params: {
  userName: string;
  recoveryLink: string;
  expiresInMinutes: number;
}): string {
  const { userName, recoveryLink, expiresInMinutes } = params;
  
  const content = `
    ${getEmailHeader()}
    
    <div style="padding: 40px 32px;">
      <h1 style="color: #111827; font-size: 24px; font-weight: 700; margin: 0 0 16px 0; text-align: center;">
        Recupera tu contraseña
      </h1>
      
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">
        Hola${userName ? ` <strong>${userName}</strong>` : ''}, recibimos una solicitud para restablecer la contraseña de tu cuenta en Kentra.
      </p>
      
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0; text-align: center;">
        Haz clic en el siguiente botón para crear una nueva contraseña:
      </p>
      
      <div style="text-align: center; margin: 0 0 32px 0;">
        <a href="${recoveryLink}" style="display: inline-block; background: linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${PRIMARY_DARK} 100%); color: white; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);">
          Restablecer Contraseña
        </a>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 0 0 16px 0; text-align: center;">
        Este enlace expira en <strong>${expiresInMinutes} minutos</strong>.
      </p>
      
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin: 0 0 24px 0;">
        <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 0; word-break: break-all;">
          Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
          <a href="${recoveryLink}" style="color: ${PRIMARY_COLOR};">${recoveryLink}</a>
        </p>
      </div>
      
      <div style="border-top: 1px solid #e5e7eb; padding-top: 24px;">
        <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; margin: 0; text-align: center;">
          Si no solicitaste restablecer tu contraseña, puedes ignorar este email. Tu contraseña actual seguirá siendo la misma.
        </p>
      </div>
    </div>
    
    ${getAntiSpamFooter()}
  `;
  
  return getAuthEmailWrapper(content);
}

/**
 * Versión texto plano del email de recuperación
 */
export function getRecoveryEmailText(params: {
  userName: string;
  recoveryLink: string;
  expiresInMinutes: number;
}): string {
  const { userName, recoveryLink, expiresInMinutes } = params;
  
  return `
Recupera tu contraseña

Hola${userName ? ` ${userName}` : ''}, recibimos una solicitud para restablecer la contraseña de tu cuenta en Kentra.

Para crear una nueva contraseña, visita este enlace:
${recoveryLink}

Este enlace expira en ${expiresInMinutes} minutos.

Si no solicitaste restablecer tu contraseña, puedes ignorar este email. Tu contraseña actual seguirá siendo la misma.

---
Este email fue enviado por Kentra porque tienes una cuenta activa.
Kentra - El Marketplace Inmobiliario de México
Ciudad de México, México

Instagram: ${EMAIL_CONFIG.socialLinks.instagram}
Facebook: ${EMAIL_CONFIG.socialLinks.facebook}

Administrar preferencias: ${EMAIL_CONFIG.unsubscribeUrl}
  `.trim();
}

/**
 * Email de confirmación de cambio de contraseña exitoso
 */
export function getPasswordChangedEmailHtml(params: {
  userName: string;
}): string {
  const { userName } = params;
  
  const content = `
    ${getEmailHeader()}
    
    <div style="padding: 40px 32px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; background-color: #d1fae5; border-radius: 50%; padding: 16px;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
      
      <h1 style="color: #111827; font-size: 24px; font-weight: 700; margin: 0 0 16px 0; text-align: center;">
        Contraseña actualizada
      </h1>
      
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">
        Hola${userName ? ` <strong>${userName}</strong>` : ''}, te confirmamos que tu contraseña ha sido cambiada exitosamente.
      </p>
      
      <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin: 0 0 24px 0;">
        <p style="color: #92400e; font-size: 14px; line-height: 1.5; margin: 0; text-align: center;">
          ⚠️ Si no realizaste este cambio, por favor contacta a nuestro equipo de soporte inmediatamente.
        </p>
      </div>
      
      <div style="text-align: center;">
        <a href="${EMAIL_CONFIG.baseUrl}" style="display: inline-block; background: linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${PRIMARY_DARK} 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
          Ir a Kentra
        </a>
      </div>
    </div>
    
    ${getAntiSpamFooter()}
  `;
  
  return getAuthEmailWrapper(content);
}

/**
 * Versión texto plano del email de confirmación de cambio
 */
export function getPasswordChangedEmailText(params: {
  userName: string;
}): string {
  const { userName } = params;
  
  return `
Contraseña actualizada

Hola${userName ? ` ${userName}` : ''}, te confirmamos que tu contraseña ha sido cambiada exitosamente.

⚠️ Si no realizaste este cambio, por favor contacta a nuestro equipo de soporte inmediatamente.

Ir a Kentra: ${EMAIL_CONFIG.baseUrl}

---
Este email fue enviado por Kentra porque tienes una cuenta activa.
Kentra - El Marketplace Inmobiliario de México
Ciudad de México, México

Instagram: ${EMAIL_CONFIG.socialLinks.instagram}
Facebook: ${EMAIL_CONFIG.socialLinks.facebook}

Administrar preferencias: ${EMAIL_CONFIG.unsubscribeUrl}
  `.trim();
}
