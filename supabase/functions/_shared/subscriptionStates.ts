/**
 * ESTADOS DE SUSCRIPCIÓN COMPARTIDOS
 * 
 * Fuente de verdad para todos los estados de suscripción en Edge Functions.
 * Mantener sincronizado con src/config/subscriptionBusinessRules.ts
 * 
 * TODO: Tests de integración críticos pendientes:
 * - [ ] Test: Webhook checkout.session.completed crea suscripción correctamente
 * - [ ] Test: Webhook invoice.payment_failed incrementa retry count
 * - [ ] Test: Transición past_due -> suspended después de 7 días
 * - [ ] Test: Trial expira correctamente después de TRIAL_DURATION_DAYS
 * - [ ] Test: Downgrade pausa propiedades excedentes
 * - [ ] Test: Upgrade inmediato activa nuevos límites
 * - [ ] Test: OXXO/SPEI incomplete -> active cuando se confirma pago
 * - [ ] Test: cancel_at_period_end preserva acceso hasta fin de período
 */

export const SUBSCRIPTION_STATUSES = {
  /** Suscripción activa y pagada */
  ACTIVE: 'active',
  /** En período de prueba gratuito */
  TRIALING: 'trialing',
  /** Pago fallido, en período de gracia (7 días) */
  PAST_DUE: 'past_due',
  /** Cancelada por el usuario o por sistema */
  CANCELED: 'canceled',
  /** Pago incompleto (OXXO/SPEI pendiente) */
  INCOMPLETE: 'incomplete',
  /** Suspendida por falta de pago después de grace period */
  SUSPENDED: 'suspended',
  /** Trial o suscripción expirada */
  EXPIRED: 'expired',
} as const;

export type SubscriptionStatusType = typeof SUBSCRIPTION_STATUSES[keyof typeof SUBSCRIPTION_STATUSES];

/**
 * Estados donde el usuario puede usar el servicio normalmente
 */
export const OPERATIONAL_STATUSES: SubscriptionStatusType[] = [
  SUBSCRIPTION_STATUSES.ACTIVE,
  SUBSCRIPTION_STATUSES.TRIALING,
];

/**
 * Estados que requieren acción inmediata del usuario
 */
export const REQUIRES_ACTION_STATUSES: SubscriptionStatusType[] = [
  SUBSCRIPTION_STATUSES.PAST_DUE,
  SUBSCRIPTION_STATUSES.INCOMPLETE,
];

/**
 * Estados donde el usuario NO puede publicar propiedades
 */
export const BLOCKED_STATUSES: SubscriptionStatusType[] = [
  SUBSCRIPTION_STATUSES.SUSPENDED,
  SUBSCRIPTION_STATUSES.EXPIRED,
  SUBSCRIPTION_STATUSES.CANCELED,
];

/**
 * Duración del período de prueba en días
 */
export const TRIAL_DURATION_DAYS = 14;

/**
 * Días de gracia para pagos fallidos antes de suspensión
 */
export const GRACE_PERIOD_DAYS = 7;

/**
 * Horas máximas para pagos OXXO/SPEI antes de expirar
 */
export const MAX_PENDING_PAYMENT_HOURS = 48;

/**
 * Verifica si un estado es operativo
 */
export function isOperationalStatus(status: string): boolean {
  return OPERATIONAL_STATUSES.includes(status as SubscriptionStatusType);
}

/**
 * Verifica si un estado requiere acción del usuario
 */
export function requiresUserAction(status: string): boolean {
  return REQUIRES_ACTION_STATUSES.includes(status as SubscriptionStatusType);
}

/**
 * Verifica si un estado bloquea la publicación
 */
export function isBlockedStatus(status: string): boolean {
  return BLOCKED_STATUSES.includes(status as SubscriptionStatusType);
}
