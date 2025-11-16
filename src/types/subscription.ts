// Tipos relacionados con suscripciones

export interface SubscriptionPlan {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number | null;
  currency: string | null;
  features: SubscriptionFeatures;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SubscriptionFeatures {
  properties_limit: number;
  featured_limit: number;
  analytics: boolean;
  priority_support: boolean;
  api_access?: boolean;
  [key: string]: any;
}

export interface SubscriptionInfo {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  featured_used_this_month: number | null;
  featured_reset_date: string | null;
  created_at: string | null;
  updated_at: string | null;
  properties_limit?: number;
  featured_limit?: number;
  plan_name?: string;
  plan_display_name?: string;
}

export interface SubscriptionChange {
  id: string;
  user_id: string;
  change_type: string;
  previous_plan_id: string | null;
  new_plan_id: string;
  previous_billing_cycle: string | null;
  new_billing_cycle: string;
  prorated_amount: number | null;
  changed_at: string;
  metadata: Record<string, any> | null;
}
