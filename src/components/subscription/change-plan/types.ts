export interface SubscriptionPlan {
  id: string;
  name: string;
  display_name: string;
  price_monthly: number;
  price_yearly: number | null;
  features: PlanFeatures;
  is_active: boolean;
}

export interface PlanFeatures {
  max_properties?: number;
  featured_per_month?: number;
  priority_support?: boolean;
  analytics?: boolean;
  team_members?: number;
  [key: string]: unknown;
}

export interface CurrentSubscription {
  plan_id: string;
  plan_name: string;
  plan_display_name: string;
  status: string;
  billing_cycle: BillingCycle;
  price_monthly: number;
  price_yearly: number | null;
  current_period_end: string;
  features: PlanFeatures;
  cancel_at_period_end?: boolean;
}

export interface ProrationPreviewData {
  amount_due: number;
  credit_amount: number;
  proration_date: string;
  currency: string;
  new_plan_price: number;
  current_plan_credit: number;
  immediate_charge: number;
}

export interface CooldownInfo {
  isInCooldown: boolean;
  lastChangeDate: string | null;
  daysRemaining: number;
  canBypass: boolean;
}

export type BillingCycle = 'monthly' | 'yearly';

export type ChangeType = 'upgrade' | 'downgrade' | 'cycle_change' | null;

export type UserRole = 'buyer' | 'agent' | 'agency' | 'moderator' | 'super_admin';
