import { z } from 'zod';
import { getCountryByCode } from '@/data/countryCodes';
import { monitoring } from '@/lib/monitoring';

/**
 * Schema de validación para número de WhatsApp internacional
 */
export const whatsappSchema = z.object({
  country_code: z.string().default("MX"),
  whatsapp_number: z.string()
    .trim()
    .min(1, "El número de WhatsApp es requerido")
    .refine((val) => {
      // Solo números permitidos
      return /^\d+$/.test(val.replace(/\D/g, ''));
    }, {
      message: "Solo se permiten números"
    }),
  whatsapp_enabled: z.boolean().default(true)
}).refine((data) => {
  // Validar según el país seleccionado
  const country = getCountryByCode(data.country_code);
  const cleaned = data.whatsapp_number.replace(/\D/g, '');
  
  // Verificar longitud
  if (cleaned.length < country.minLength || cleaned.length > country.maxLength) {
    return false;
  }
  
  // Verificar patrón específico del país
  return country.pattern.test(cleaned);
}, (data) => {
  const country = getCountryByCode(data.country_code);
  return {
    message: `Número inválido para ${country.name}. ${
      country.minLength === country.maxLength 
        ? `Debe tener ${country.minLength} dígitos` 
        : `Debe tener entre ${country.minLength} y ${country.maxLength} dígitos`
    }`,
    path: ["whatsapp_number"]
  };
});

export type WhatsAppFormData = z.infer<typeof whatsappSchema>;

/**
 * Formatea un número de teléfono para WhatsApp con código de país
 * @param number - Número de teléfono local (sin código de país)
 * @param countryCode - Código del país (ej: "MX", "US", "ES")
 * @returns Número formateado con código de país en formato E.164
 */
export const formatWhatsAppNumber = (number: string, countryCode: string = "MX"): string => {
  if (!number) return '';
  
  const country = getCountryByCode(countryCode);
  let cleaned = number.replace(/\D/g, '');
  
  // Evitar duplicar el dialCode si ya existe
  const dialCodeDigits = country.dialCode.replace('+', '');
  if (cleaned.startsWith(dialCodeDigits)) {
    cleaned = cleaned.substring(dialCodeDigits.length);
  }
  
  return `${country.dialCode}${cleaned}`;
};

/**
 * Valida si un número es válido para el país especificado
 * @param number - Número a validar (local, sin código de país)
 * @param countryCode - Código del país
 * @returns true si es válido, false si no
 */
export const isValidPhoneForCountry = (number: string, countryCode: string): boolean => {
  if (!number) return false;
  
  const country = getCountryByCode(countryCode);
  const cleaned = number.replace(/\D/g, '');
  
  // Verificar longitud
  if (cleaned.length < country.minLength || cleaned.length > country.maxLength) {
    return false;
  }
  
  // Verificar patrón específico del país
  return country.pattern.test(cleaned);
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
    monitoring.warn('Invalid phone number for WhatsApp', { util: 'whatsapp', phoneNumber });
    return '#';
  }
  
  // Remover el + del número para la URL
  const cleanNumber = formattedNumber.replace('+', '');
  
  // Encodear el mensaje para URL
  const encodedMessage = encodeURIComponent(message);
  
  return `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
};

/**
 * Formatea un número para mostrar en UI con formato apropiado
 * @param number - Número completo con código de país o número local
 * @param countryCode - Código del país (opcional, se detectará si no se proporciona)
 * @returns Número formateado para mostrar
 */
export const formatPhoneDisplay = (number: string, countryCode?: string): string => {
  if (!number) return '';
  
  const cleaned = number.replace(/\D/g, '');
  
  // Detectar país si no se proporciona
  let detectedCountry = countryCode;
  if (!detectedCountry) {
    // Intentar detectar del número completo
    if (cleaned.startsWith('52') && cleaned.length === 12) {
      detectedCountry = 'MX';
    } else if (cleaned.startsWith('1') && cleaned.length === 11) {
      detectedCountry = 'US';
    } else if (cleaned.startsWith('34') && cleaned.length === 11) {
      detectedCountry = 'ES';
    } else {
      detectedCountry = 'MX'; // Default
    }
  }
  
  const country = getCountryByCode(detectedCountry);
  const dialCode = country.dialCode;
  
  // Extraer número local
  let localNumber = cleaned;
  const prefix = dialCode.replace('+', '');
  if (cleaned.startsWith(prefix)) {
    localNumber = cleaned.slice(prefix.length);
  }
  
  // Formatear según el país
  if (country.code === 'MX' && localNumber.length === 10) {
    // +52 55-1234-5678
    return `${dialCode} ${localNumber.slice(0, 2)}-${localNumber.slice(2, 6)}-${localNumber.slice(6)}`;
  } else if ((country.code === 'US' || country.code === 'CA') && localNumber.length === 10) {
    // +1 (202) 555-1234
    return `${dialCode} (${localNumber.slice(0, 3)}) ${localNumber.slice(3, 6)}-${localNumber.slice(6)}`;
  } else if (country.code === 'ES' && localNumber.length === 9) {
    // +34 612 34 56 78
    return `${dialCode} ${localNumber.slice(0, 3)} ${localNumber.slice(3, 5)} ${localNumber.slice(5, 7)} ${localNumber.slice(7)}`;
  } else {
    // Formato genérico: +XX XXXXXXXXX
    return `${dialCode} ${localNumber}`;
  }
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
