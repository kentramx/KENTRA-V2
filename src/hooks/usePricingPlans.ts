import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PricingPlan {
  id: string;
  name: string;
  display_name: string;
  price_monthly: number;
  price_yearly: number | null;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  features: {
    // Estructura anidada (preferida)
    limits?: {
      max_properties?: number;
      featured_per_month?: number;
      max_agents?: number;
      max_projects?: number;
    };
    // Fallback para estructura plana legacy
    max_properties?: number;
    properties_limit?: number;
    featured_listings?: number;
    featured_per_month?: number;
    max_agents?: number;
    max_projects?: number;
    proyectos?: number;
    priority_support?: boolean;
    analytics?: boolean;
    autopublicacion?: boolean;
    reportes_avanzados?: boolean;
    gestion_equipo?: boolean;
    soporte_prioritario?: boolean;
    landing_pages?: boolean;
    [key: string]: any;
  };
  is_active: boolean;
  description?: string | null;
}

export type PlanType = 'agent' | 'agency' | 'developer';

/**
 * Hook to fetch pricing plans from the database
 * @param planType - The type of plans to fetch (agent, agency, developer)
 */
export function usePricingPlans(planType: PlanType) {
  // Map planType to the prefix used in plan names
  const prefixMap: Record<PlanType, string> = {
    agent: 'agente',
    agency: 'inmobiliaria',
    developer: 'desarrolladora',
  };
  
  const prefix = prefixMap[planType];
  
  return useQuery({
    queryKey: ['pricing-plans', planType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .ilike('name', `${prefix}_%`)
        .order('price_monthly', { ascending: true });

      if (error) throw error;
      return data as PricingPlan[];
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

/**
 * Get the property limit for a plan - reads nested structure first
 */
export function getPlanPropertyLimit(plan: PricingPlan): number {
  return plan.features.limits?.max_properties 
    ?? plan.features.max_properties 
    ?? plan.features.properties_limit 
    ?? 0;
}

/**
 * Get the featured listings limit for a plan - reads nested structure first
 */
export function getPlanFeaturedLimit(plan: PricingPlan): number {
  return plan.features.limits?.featured_per_month
    ?? plan.features.featured_listings 
    ?? plan.features.featured_per_month 
    ?? 0;
}

/**
 * Get the max agents for a plan (agency plans) - reads nested structure first
 */
export function getPlanMaxAgents(plan: PricingPlan): number {
  return plan.features.limits?.max_agents 
    ?? plan.features.max_agents 
    ?? 0;
}

/**
 * Get the max projects for a plan (developer plans) - reads nested structure first
 */
export function getPlanMaxProjects(plan: PricingPlan): number {
  return plan.features.limits?.max_projects 
    ?? plan.features.max_projects 
    ?? plan.features.proyectos 
    ?? 0;
}

/**
 * Format a price for display
 */
export function formatPrice(price: number): string {
  return price.toLocaleString('es-MX');
}

/**
 * Calculate annual savings when paying yearly vs monthly
 */
export function calculateAnnualSavings(monthlyPrice: number, yearlyPrice: number): number {
  const yearlyIfMonthly = monthlyPrice * 12;
  return yearlyIfMonthly - yearlyPrice;
}

/**
 * Calculate the discount percentage for annual billing
 */
export function calculateDiscountPercent(monthlyPrice: number, yearlyPrice: number): number {
  const yearlyIfMonthly = monthlyPrice * 12;
  if (yearlyIfMonthly === 0) return 0;
  return Math.round(((yearlyIfMonthly - yearlyPrice) / yearlyIfMonthly) * 100);
}

/**
 * Get the monthly equivalent of a yearly price
 */
export function getMonthlyEquivalent(yearlyPrice: number): number {
  return Math.round((yearlyPrice / 12) * 100) / 100;
}
