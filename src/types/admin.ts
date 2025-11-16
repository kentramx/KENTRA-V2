// Tipos para componentes de administración avanzada

export interface AdminMetricRaw {
  [key: string]: string | number | null | undefined;
}

export interface AdminAnalyticsRow {
  date?: string;
  count?: number;
  value?: number;
  [key: string]: string | number | null | undefined;
}

export interface TransactionMetadata {
  plan_id?: string;
  plan_name?: string;
  billing_cycle?: string;
  coupon_code?: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface MarketingMetricsRaw {
  total_events?: number | null;
  conversions?: number | null;
  total_value?: number | null;
  events_by_type?: Array<{
    event_type: string;
    count: number;
    total_value: number;
  }> | null;
  daily_trend?: Array<{
    date: string;
    total_events: number;
    conversions: number;
    total_value: number;
  }> | null;
  funnel_data?: {
    view_content?: number;
    initiate_checkout?: number;
    purchase?: number;
  } | null;
}
