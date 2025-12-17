/**
 * CONFIGURACIÓN CENTRALIZADA DE ICONOS Y ESTILOS DE PLANES
 * 
 * USAR ESTE CONFIG EN TODO EL CODEBASE para consistencia visual
 * 
 * Iconos por tier:
 * - Elite: Crown (corona dorada)
 * - Pro: Sparkles (chispas)
 * - Basic/Starter: Star (estrella)
 * - Trial: Clock (reloj)
 * - Free/None: Home (casa)
 */

import { 
  Crown, 
  Sparkles, 
  Star, 
  Clock, 
  Home,
  Eye,
  Bell,
  Calendar,
  CheckCircle,
  AlertTriangle,
  User,
  Building2,
  HardHat,
  type LucideIcon 
} from 'lucide-react';

export type PlanTier = 'elite' | 'pro' | 'basic' | 'trial' | 'free' | 'none';
export type UserType = 'agent' | 'agency' | 'developer';

export interface TierConfig {
  icon: LucideIcon;
  gradient: string;
  badge: string;
  accent: string;
  progressColor: string;
  iconBg: string;
  iconColor: string;
  border: string;
}

export const PLAN_TIER_CONFIG: Record<PlanTier, TierConfig> = {
  elite: {
    icon: Crown,
    gradient: 'from-amber-500/10 via-yellow-500/5 to-orange-500/10',
    badge: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-0 shadow-lg shadow-amber-500/30',
    accent: 'text-amber-500',
    progressColor: 'bg-amber-500',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    border: 'border-amber-300',
  },
  pro: {
    icon: Sparkles,
    gradient: 'from-primary/10 via-secondary/5 to-accent/10',
    badge: 'bg-gradient-to-r from-primary to-secondary text-white border-0 shadow-lg shadow-primary/30',
    accent: 'text-primary',
    progressColor: 'bg-primary',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    border: 'border-primary/40',
  },
  basic: {
    icon: Star,
    gradient: 'from-secondary/10 via-muted/5 to-secondary/10',
    badge: 'bg-secondary text-secondary-foreground border border-border shadow-md',
    accent: 'text-secondary-foreground',
    progressColor: 'bg-secondary',
    iconBg: 'bg-secondary/50',
    iconColor: 'text-secondary-foreground',
    border: 'border-border',
  },
  trial: {
    icon: Clock,
    gradient: 'from-blue-500/10 via-cyan-500/5 to-blue-500/10',
    badge: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0 shadow-lg shadow-blue-500/30',
    accent: 'text-blue-500',
    progressColor: 'bg-blue-500',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    border: 'border-blue-300 border-dashed',
  },
  free: {
    icon: Home,
    gradient: 'from-muted/20 via-background to-muted/20',
    badge: 'bg-muted text-muted-foreground border border-border',
    accent: 'text-muted-foreground',
    progressColor: 'bg-muted-foreground',
    iconBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
    border: 'border-border border-dashed',
  },
  none: {
    icon: Home,
    gradient: 'from-muted/30 via-card to-muted/20',
    badge: 'bg-muted text-muted-foreground border border-border',
    accent: 'text-muted-foreground',
    progressColor: 'bg-muted-foreground',
    iconBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
    border: 'border-border border-dashed',
  },
};

/**
 * Configuración por tipo de usuario - visible públicamente
 */
export const USER_TYPE_CONFIG: Record<UserType, {
  icon: LucideIcon;
  label: string;
  labelShort: string;
}> = {
  agent: {
    icon: User,
    label: 'Agente',
    labelShort: 'Agente',
  },
  agency: {
    icon: Building2,
    label: 'Inmobiliaria',
    labelShort: 'Inmob.',
  },
  developer: {
    icon: HardHat,
    label: 'Desarrolladora',
    labelShort: 'Desarr.',
  },
};

/**
 * Iconos para métricas - usar consistentemente en todo el dashboard
 */
export const METRIC_ICONS = {
  properties: Home,
  featured: Star,
  views: Eye,
  alerts: Bell,
  renewal: Calendar,
  active: CheckCircle,
  warning: AlertTriangle,
} as const;

/**
 * Detecta el tier del plan basado en su nombre
 */
export function getPlanTier(planName?: string | null): PlanTier {
  if (!planName) return 'none';
  
  const lower = planName.toLowerCase();
  
  if (lower.includes('elite') || lower.includes('premium') || lower.includes('grow')) return 'elite';
  if (lower.includes('pro') || lower.includes('profesional')) return 'pro';
  if (lower.includes('trial') || lower.includes('prueba')) return 'trial';
  if (lower.includes('start') || lower.includes('basico') || lower.includes('basic') || lower.includes('inicial')) return 'basic';
  
  return 'basic';
}

/**
 * Detecta el tipo de usuario desde el nombre del plan
 */
export function getUserTypeFromPlan(planName?: string | null): UserType {
  if (!planName) return 'agent';
  const lower = planName.toLowerCase();
  
  if (lower.includes('inmobiliaria')) return 'agency';
  if (lower.includes('desarrolladora')) return 'developer';
  return 'agent'; // Default: agente
}

/**
 * Extrae el nombre corto del tier (Elite, Pro, Start, etc.)
 */
export function getShortTierName(planName?: string | null): string {
  if (!planName) return '';
  const lower = planName.toLowerCase();
  
  if (lower.includes('elite')) return 'Elite';
  if (lower.includes('grow')) return 'Grow';
  if (lower.includes('pro')) return 'Pro';
  if (lower.includes('start')) return 'Start';
  if (lower.includes('trial') || lower.includes('prueba')) return 'Trial';
  if (lower.includes('basic') || lower.includes('basico')) return 'Básico';
  
  return '';
}

/**
 * Obtiene la configuración completa del tier
 */
export function getTierConfig(planName?: string | null): TierConfig {
  const tier = getPlanTier(planName);
  return PLAN_TIER_CONFIG[tier];
}

/**
 * Obtiene solo el icono del tier
 */
export function getTierIcon(planName?: string | null): LucideIcon {
  return getTierConfig(planName).icon;
}
