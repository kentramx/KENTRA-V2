/**
 * HELPER UNIFICADO PARA LEER LÍMITES DE PLANES
 * 
 * Este helper maneja ambas estructuras de features:
 * - Estructura nested (nueva): features.limits.max_properties
 * - Estructura flat (legacy): features.max_properties
 * 
 * USAR ESTE HELPER EN TODO EL CODEBASE para consistencia
 */

export interface PlanLimits {
  maxProperties: number;
  featuredPerMonth: number;
  maxAgents: number;
  maxProjects: number;
}

export interface PlanFeatures {
  limits?: {
    max_properties?: number;
    featured_per_month?: number;
    max_agents?: number;
    max_projects?: number;
  };
  // Fallback flat structure (legacy)
  max_properties?: number;
  properties_limit?: number;
  featured_listings?: number;
  featured_per_month?: number;
  max_agents?: number;
  max_projects?: number;
  proyectos?: number;
  [key: string]: unknown;
}

/**
 * Extrae los límites de un plan desde su objeto features
 * Maneja tanto estructura nested como flat para compatibilidad
 * 
 * @param features - Objeto features del plan (puede ser nested o flat)
 * @returns PlanLimits con valores normalizados (0 = sin límite definido, -1 = ilimitado)
 */
export function getPlanLimits(features: PlanFeatures | null | undefined): PlanLimits {
  if (!features) {
    return {
      maxProperties: 0,
      featuredPerMonth: 0,
      maxAgents: 0,
      maxProjects: 0,
    };
  }

  // Priorizar estructura nested, luego flat
  const maxProperties = 
    features.limits?.max_properties ??
    features.max_properties ??
    features.properties_limit ??
    0;

  const featuredPerMonth = 
    features.limits?.featured_per_month ??
    features.featured_per_month ??
    features.featured_listings ??
    0;

  const maxAgents = 
    features.limits?.max_agents ??
    features.max_agents ??
    0;

  const maxProjects = 
    features.limits?.max_projects ??
    features.max_projects ??
    features.proyectos ??
    0;

  return {
    maxProperties,
    featuredPerMonth,
    maxAgents,
    maxProjects,
  };
}

/**
 * Verifica si un límite es "ilimitado"
 * Por convención, -1 significa ilimitado
 */
export function isUnlimited(limit: number): boolean {
  return limit === -1;
}

/**
 * Formatea un límite para display
 * -1 → "Ilimitado", 0 → "0", n → "n"
 */
export function formatLimit(limit: number): string {
  if (limit === -1) return 'Ilimitado';
  return limit.toString();
}

/**
 * Calcula slots disponibles considerando ilimitado
 */
export function getAvailableSlots(used: number, limit: number): number {
  if (limit === -1) return Infinity;
  return Math.max(0, limit - used);
}

/**
 * Verifica si puede crear más items dado el uso actual
 */
export function canCreate(used: number, limit: number): boolean {
  if (limit === -1) return true;
  return used < limit;
}
