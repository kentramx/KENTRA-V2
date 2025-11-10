import { z } from 'zod';

/**
 * Schema de validación para número de WhatsApp mexicano
 */
export const whatsappSchema = z.object({
  whatsapp_number: z.string()
    .trim()
    .regex(/^(\+?52)?[1-9]\d{9}$/, {
      message: "Ingresa un número válido de 10 dígitos (ejemplo: 5512345678)"
    })
    .transform(val => {
      // Remover cualquier carácter que no sea número
      const cleaned = val.replace(/\D/g, '');
      // Si empieza con 52, removerlo para normalizarlo
      return cleaned.startsWith('52') ? cleaned.slice(2) : cleaned;
    }),
  whatsapp_enabled: z.boolean().default(true),
  whatsapp_business_hours: z.string().max(100).optional()
});

export type WhatsAppFormData = z.infer<typeof whatsappSchema>;

/**
 * Formatea un número de teléfono mexicano para WhatsApp
 * @param number - Número de teléfono (puede incluir o no el código de país)
 * @returns Número formateado con código de país +52
 */
export const formatWhatsAppNumber = (number: string): string => {
  if (!number) return '';
  
  // Remover todos los caracteres no numéricos
  const cleaned = number.replace(/\D/g, '');
  
  // Si ya tiene el código de país 52, retornarlo con +
  if (cleaned.startsWith('52') && cleaned.length === 12) {
    return `+${cleaned}`;
  }
  
  // Si es un número de 10 dígitos, agregar +52
  if (cleaned.length === 10) {
    return `+52${cleaned}`;
  }
  
  // Si no cumple con el formato esperado, retornar vacío
  return '';
};

/**
 * Valida si un número es un teléfono mexicano válido
 * @param number - Número a validar
 * @returns true si es válido, false si no
 */
export const isValidMexicanPhone = (number: string): boolean => {
  if (!number) return false;
  
  const cleaned = number.replace(/\D/g, '');
  
  // Debe ser 10 dígitos (sin código de país) o 12 dígitos (con 52)
  if (cleaned.length === 10) {
    // No debe empezar con 0 o 1
    return /^[2-9]\d{9}$/.test(cleaned);
  }
  
  if (cleaned.length === 12 && cleaned.startsWith('52')) {
    const localNumber = cleaned.slice(2);
    return /^[2-9]\d{9}$/.test(localNumber);
  }
  
  return false;
};

/**
 * Genera la URL de WhatsApp Web/App con mensaje predefinido
 * @param phoneNumber - Número de teléfono del destinatario
 * @param message - Mensaje a enviar
 * @returns URL completa de WhatsApp
 */
export const getWhatsAppUrl = (phoneNumber: string, message: string): string => {
  const formattedNumber = formatWhatsAppNumber(phoneNumber);
  
  if (!formattedNumber) {
    console.error('Invalid phone number for WhatsApp');
    return '#';
  }
  
  // Remover el + del número para la URL
  const cleanNumber = formattedNumber.replace('+', '');
  
  // Encodear el mensaje para URL
  const encodedMessage = encodeURIComponent(message);
  
  return `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
};

/**
 * Formatea un número para mostrar en UI (con guiones)
 * @param number - Número a formatear
 * @returns Número formateado para mostrar (ej: +52 55-1234-5678)
 */
export const formatPhoneDisplay = (number: string): string => {
  const formatted = formatWhatsAppNumber(number);
  
  if (!formatted || formatted.length !== 13) return number;
  
  // +52 XX-XXXX-XXXX
  return `${formatted.slice(0, 3)} ${formatted.slice(3, 5)}-${formatted.slice(5, 9)}-${formatted.slice(9)}`;
};

/**
 * Templates de mensajes predefinidos para diferentes contextos
 */
export const WhatsAppTemplates = {
  /**
   * Mensaje para consulta sobre una propiedad específica
   */
  property: (title: string, location: string): string => {
    return `Hola, me interesa la propiedad "${title}" en ${location}. ¿Podríamos agendar una visita?`;
  },
  
  /**
   * Mensaje para contactar a un agente directamente
   */
  agent: (agentName: string): string => {
    return `Hola ${agentName}, vi tu perfil en Kentra y me gustaría saber más sobre tus propiedades disponibles.`;
  },
  
  /**
   * Mensaje general de consulta
   */
  general: (): string => {
    return `Hola, estoy navegando en Kentra y necesito ayuda con información sobre propiedades.`;
  },
  
  /**
   * Mensaje para inmobiliaria
   */
  agency: (agencyName: string): string => {
    return `Hola, me interesa conocer más sobre las propiedades de ${agencyName}.`;
  }
};
