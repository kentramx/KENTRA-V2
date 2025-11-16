/**
 * Tipos para suscripciones y planes
 */

export interface SubscriptionFeatures {
  max_properties?: number;
  max_agents?: number;
  featured_properties?: boolean;
  analytics?: boolean;
  priority_support?: boolean;
  api_access?: boolean;
  custom_branding?: boolean;
  [key: string]: boolean | number | string | undefined;
}

export interface SubscriptionInfo {
  id: string;
  plan_id: string;
  user_id: string;
  status: 'active' | 'past_due' | 'canceled' | 'trial' | 'inactive';
  current_period_start: string;
  current_period_end: string;
  trial_start?: string | null;
  trial_end?: string | null;
  stripe_subscription_id?: string | null;
  stripe_customer_id?: string | null;
  cancel_at_period_end: boolean;
  features?: SubscriptionFeatures;
  plan?: {
    id: string;
    name: string;
    slug: string;
    price_monthly: number;
    price_yearly: number;
    features: SubscriptionFeatures;
  };
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  stripe_product_id: string | null;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  features: SubscriptionFeatures;
  is_active: boolean;
  display_order: number;
}

export interface SubscriptionChange {
  id: string;
  user_id: string;
  old_plan_id: string | null;
  new_plan_id: string | null;
  change_type: 'upgrade' | 'downgrade' | 'cancel' | 'reactivate' | 'trial_start' | 'trial_end';
  old_status: string | null;
  new_status: string;
  changed_by: string;
  is_admin_change: boolean;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}
