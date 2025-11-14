/**
 * CONFIGURACIÓN CENTRALIZADA DE REGLAS DE NEGOCIO
 * 
 * Este archivo define todas las reglas de negocio relacionadas con:
 * - Límites de propiedades por plan
 * - Límites de propiedades destacadas
 * - Upsells y slots adicionales
 * - Comportamiento según estado de suscripción
 * 
 * FUENTE DE VERDAD: La base de datos (tabla subscription_plans)
 * Este archivo proporciona helpers y constantes, pero los límites
 * reales deben consultarse desde la DB mediante get_user_subscription_info()
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// TIPOS Y ESTADOS
// ============================================================================

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';

export interface SubscriptionInfo {
  has_subscription: boolean;
  name: string; // e.g., 'agente_basico', 'agente_pro'
  display_name: string;
  features: any; // JSONB from DB
  status: SubscriptionStatus;
  current_period_end: string;
  cancel_at_period_end?: boolean; // Optional para compatibilidad
  properties_used: number;
  properties_limit: number;
  featured_used: number;
  featured_limit: number;
}

export interface PropertyLimitValidation {
  canPublish: boolean;
  reason: string;
  currentCount: number;
  maxAllowed: number;
  availableSlots: number;
}

export interface FeaturedLimitValidation {
  canFeature: boolean;
  reason: string;
  currentCount: number;
  maxAllowed: number;
  availableSlots: number;
}

// ============================================================================
// CONSTANTES DE NEGOCIO
// ============================================================================

/**
 * Límite para usuarios sin suscripción (role: buyer)
 */
export const FREE_USER_LISTING_LIMIT = 1;

/**
 * Duración estándar de propiedades destacadas (en días)
 */
export const DEFAULT_FEATURED_DURATION_DAYS = 30;

/**
 * Costo de destacar una propiedad por 30 días (MXN)
 */
export const FEATURED_PROPERTY_COST_30_DAYS = 500;

/**
 * Umbrales de advertencia (porcentaje de uso)
 */
export const LIMITS = {
  WARNING_THRESHOLD: 0.8, // Advertir al 80% de uso
  CRITICAL_THRESHOLD: 0.95, // Crítico al 95% de uso
} as const;

/**
 * Identificadores de tipos de upsells
 */
export const UPSELL_TYPES = {
  PROPERTY_SLOT: 'slot_propiedad', // Para filtrar upsells de slots adicionales
  FEATURED_PROPERTY: 'destacar_propiedad', // Para filtrar upsells de destacados
} as const;

// ============================================================================
// FUNCIONES DE VALIDACIÓN (cliente)
// ============================================================================

/**
 * Valida si el usuario puede publicar una nueva propiedad
 * Considera: plan base + slots adicionales de upsells
 * 
 * IMPORTANTE: Esta es una validación del lado del cliente.
 * La validación definitiva se hace en can_create_property() en la DB.
 */
export async function validatePropertyLimits(
  userId: string
): Promise<PropertyLimitValidation> {
  try {
    // Obtener info de suscripción (incluye properties_limit y properties_used)
    const { data: subInfo, error } = await supabase.rpc('get_user_subscription_info', {
      user_uuid: userId,
    });

    if (error) throw error;

    if (!subInfo || subInfo.length === 0) {
      return {
        canPublish: false,
        reason: 'Necesitas una suscripción activa para publicar propiedades como agente',
        currentCount: 0,
        maxAllowed: 0,
        availableSlots: 0,
      };
    }

    const subscription = subInfo[0] as SubscriptionInfo;

    // Validar estado de suscripción
    if (subscription.status === 'past_due') {
      return {
        canPublish: false,
        reason: 'Hay un problema con tu pago. Actualiza tu método de pago para seguir publicando.',
        currentCount: subscription.properties_used,
        maxAllowed: subscription.properties_limit,
        availableSlots: 0,
      };
    }

    if (subscription.status === 'canceled') {
      const periodEnd = new Date(subscription.current_period_end);
      const now = new Date();
      
      if (now > periodEnd) {
        return {
          canPublish: false,
          reason: 'Tu suscripción ha expirado. Reactívala para seguir publicando.',
          currentCount: subscription.properties_used,
          maxAllowed: subscription.properties_limit,
          availableSlots: 0,
        };
      }
      // Aún dentro del período pagado
    }

    // Calcular slots disponibles (incluye upsells)
    const maxAllowed = subscription.properties_limit;
    const currentCount = subscription.properties_used;

    // Ilimitado
    if (maxAllowed === -1) {
      return {
        canPublish: true,
        reason: 'Propiedades ilimitadas',
        currentCount,
        maxAllowed: -1,
        availableSlots: 999,
      };
    }

    // Con límite
    const availableSlots = Math.max(0, maxAllowed - currentCount);
    const canPublish = availableSlots > 0;

    return {
      canPublish,
      reason: canPublish
        ? `Puedes publicar ${availableSlots} propiedad${availableSlots === 1 ? '' : 'es'} más`
        : `Has alcanzado el límite de ${maxAllowed} propiedades de tu plan. Mejora tu plan o contrata slots adicionales.`,
      currentCount,
      maxAllowed,
      availableSlots,
    };
  } catch (error) {
    console.error('Error validating property limits:', error);
    return {
      canPublish: false,
      reason: 'Error al validar límites. Intenta de nuevo.',
      currentCount: 0,
      maxAllowed: 0,
      availableSlots: 0,
    };
  }
}

/**
 * Valida si el usuario puede destacar una propiedad
 * Considera el límite mensual de destacadas incluidas en el plan
 */
export async function validateFeaturedLimits(
  userId: string
): Promise<FeaturedLimitValidation> {
  try {
    const { data: subInfo, error } = await supabase.rpc('get_user_subscription_info', {
      user_uuid: userId,
    });

    if (error) throw error;

    if (!subInfo || subInfo.length === 0) {
      return {
        canFeature: false,
        reason: 'Necesitas una suscripción activa para destacar propiedades',
        currentCount: 0,
        maxAllowed: 0,
        availableSlots: 0,
      };
    }

    const subscription = subInfo[0] as SubscriptionInfo;

    // Validar estado
    if (subscription.status === 'past_due' || subscription.status === 'canceled') {
      return {
        canFeature: false,
        reason: 'Tu suscripción no está activa. Reactívala para destacar propiedades.',
        currentCount: subscription.featured_used,
        maxAllowed: subscription.featured_limit,
        availableSlots: 0,
      };
    }

    const maxAllowed = subscription.featured_limit;
    const currentCount = subscription.featured_used;
    const availableSlots = Math.max(0, maxAllowed - currentCount);
    const canFeature = availableSlots > 0;

    return {
      canFeature,
      reason: canFeature
        ? `Puedes destacar ${availableSlots} propiedad${availableSlots === 1 ? '' : 'es'} más este mes`
        : `Has usado tus ${maxAllowed} destacadas de este mes. Se reinician el próximo ciclo o contrata un upsell.`,
      currentCount,
      maxAllowed,
      availableSlots,
    };
  } catch (error) {
    console.error('Error validating featured limits:', error);
    return {
      canFeature: false,
      reason: 'Error al validar límites de destacadas. Intenta de nuevo.',
      currentCount: 0,
      maxAllowed: 0,
      availableSlots: 0,
    };
  }
}

/**
 * Calcula el porcentaje de uso de propiedades
 */
export function calculateUsagePercentage(used: number, limit: number): number {
  if (limit === -1) return 0; // Ilimitado
  if (limit === 0) return 100; // Sin límite = 100% usado
  return Math.min(100, (used / limit) * 100);
}

/**
 * Determina si el usuario está cerca del límite (warning)
 */
export function isNearLimit(used: number, limit: number): boolean {
  if (limit === -1) return false;
  const percentage = calculateUsagePercentage(used, limit);
  return percentage >= LIMITS.WARNING_THRESHOLD * 100;
}

/**
 * Determina si el usuario está en estado crítico
 */
export function isCriticalLimit(used: number, limit: number): boolean {
  if (limit === -1) return false;
  const percentage = calculateUsagePercentage(used, limit);
  return percentage >= LIMITS.CRITICAL_THRESHOLD * 100;
}

// ============================================================================
// HELPERS DE ESTADO DE SUSCRIPCIÓN
// ============================================================================

/**
 * Verifica si la suscripción está operativa (puede usar funciones)
 */
export function isSubscriptionOperational(status: SubscriptionStatus): boolean {
  return status === 'active' || status === 'trialing';
}

/**
 * Verifica si la suscripción requiere atención del usuario
 */
export function requiresUserAction(status: SubscriptionStatus): boolean {
  return status === 'past_due' || status === 'incomplete';
}

/**
 * Obtiene un mensaje amigable según el estado de suscripción
 */
export function getSubscriptionStatusMessage(
  status: SubscriptionStatus,
  periodEnd?: string
): string {
  switch (status) {
    case 'active':
      return 'Tu plan está activo';
    case 'trialing':
      return 'Estás en período de prueba';
    case 'past_due':
      return 'Hay un problema con tu pago. Actualiza tu método de pago para no perder acceso.';
    case 'canceled':
      if (periodEnd) {
        const endDate = new Date(periodEnd);
        const now = new Date();
        if (now < endDate) {
          return `Tu plan está cancelado pero tienes acceso hasta ${endDate.toLocaleDateString('es-MX')}`;
        }
      }
      return 'Tu plan está cancelado. Reactívalo para seguir usando las funciones.';
    case 'incomplete':
      return 'Tu pago está incompleto. Completa el proceso para activar tu plan.';
    default:
      return 'Estado de suscripción desconocido';
  }
}

// ============================================================================
// HELPERS DE DOWNGRADE/UPGRADE
// ============================================================================

/**
 * Valida si se puede hacer downgrade al plan objetivo
 * Considera si el usuario tiene más propiedades activas que el nuevo límite
 */
export async function validateDowngrade(
  userId: string,
  newPlanMaxProperties: number
): Promise<{ canDowngrade: boolean; reason: string; excessCount: number }> {
  try {
    const { data: subInfo } = await supabase.rpc('get_user_subscription_info', {
      user_uuid: userId,
    });

    if (!subInfo || subInfo.length === 0) {
      return { canDowngrade: true, reason: '', excessCount: 0 };
    }

    const currentUsed = subInfo[0].properties_used;

    if (newPlanMaxProperties === -1) {
      // Nuevo plan es ilimitado, siempre puede
      return { canDowngrade: true, reason: '', excessCount: 0 };
    }

    if (currentUsed > newPlanMaxProperties) {
      const excess = currentUsed - newPlanMaxProperties;
      return {
        canDowngrade: false,
        reason: `Tienes ${currentUsed} propiedades activas, pero el plan nuevo permite solo ${newPlanMaxProperties}. Debes desactivar ${excess} propiedad${excess === 1 ? '' : 'es'} primero.`,
        excessCount: excess,
      };
    }

    return { canDowngrade: true, reason: '', excessCount: 0 };
  } catch (error) {
    console.error('Error validating downgrade:', error);
    return {
      canDowngrade: false,
      reason: 'Error al validar el cambio de plan',
      excessCount: 0,
    };
  }
}

/**
 * Determina el plan recomendado para upgrade según el uso actual
 */
export function getRecommendedUpgrade(
  currentPlan: string,
  currentUsed: number,
  currentLimit: number
): { planName: string; reason: string } | null {
  // Si está cerca del límite o lo excedió
  if (currentLimit !== -1 && currentUsed >= currentLimit * LIMITS.WARNING_THRESHOLD) {
    if (currentPlan.includes('basico')) {
      return {
        planName: 'Pro',
        reason: 'Estás cerca del límite. El plan Pro te da más propiedades.',
      };
    }
    if (currentPlan.includes('pro')) {
      return {
        planName: 'Elite',
        reason: 'El plan Elite te da propiedades ilimitadas.',
      };
    }
  }

  return null;
}
