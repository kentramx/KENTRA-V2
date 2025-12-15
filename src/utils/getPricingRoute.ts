/**
 * Returns the appropriate pricing page route based on user's plan or role.
 * @param userRole - The user's role (agent, agency, developer)
 * @param planName - The subscription plan name (optional)
 * @returns The pricing route path
 */
export function getPricingRoute(userRole?: string | null, planName?: string | null): string {
  // If we have the plan name, use it for more accuracy
  if (planName) {
    if (planName.includes('inmobiliaria')) return '/pricing-inmobiliaria';
    if (planName.includes('desarrolladora')) return '/pricing-desarrolladora';
    if (planName.includes('agente')) return '/pricing-agente';
  }
  
  // Otherwise, use the user role
  if (userRole === 'agency') return '/pricing-inmobiliaria';
  if (userRole === 'developer') return '/pricing-desarrolladora';
  
  // Default for agents and buyers
  return '/pricing-agente';
}
