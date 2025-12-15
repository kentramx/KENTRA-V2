-- =====================================================
-- FASE 1: BASE DE DATOS NIVEL ENTERPRISE
-- Sistema de Suscripciones Kentra
-- =====================================================

-- =====================================================
-- 1.1 ÍNDICES OPTIMIZADOS ADICIONALES
-- =====================================================

-- Índice para webhook lookups (Stripe customer)
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer 
ON public.user_subscriptions(stripe_customer_id) 
WHERE stripe_customer_id IS NOT NULL;

-- Índice para dunning queries (pagos fallidos)
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_past_due 
ON public.user_subscriptions(status, updated_at) 
WHERE status = 'past_due';

-- Índice compuesto para admin dashboard metrics
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_metrics 
ON public.user_subscriptions(status, billing_cycle, created_at);

-- Índice para cooldown lookup en cambios de plan
CREATE INDEX IF NOT EXISTS idx_subscription_changes_cooldown 
ON public.subscription_changes(user_id, changed_at DESC);

-- Índice para upsells activos (lookup rápido)
CREATE INDEX IF NOT EXISTS idx_user_active_upsells_lookup 
ON public.user_active_upsells(user_id, status, end_date) 
WHERE status = 'active';

-- Índice para disputes activas
CREATE INDEX IF NOT EXISTS idx_payment_disputes_active 
ON public.payment_disputes(status, created_at) 
WHERE status NOT IN ('won', 'lost');

-- Índice para coupon redemptions lookup
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_lookup 
ON public.coupon_redemptions(user_id, coupon_id);

-- Índice para payment_history por fecha
CREATE INDEX IF NOT EXISTS idx_payment_history_date 
ON public.payment_history(user_id, created_at DESC);

-- =====================================================
-- 1.2 CONSTRAINTS DE INTEGRIDAD
-- =====================================================

-- Constraint para billing_cycle válido
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_billing_cycle'
  ) THEN
    ALTER TABLE public.user_subscriptions 
    ADD CONSTRAINT chk_billing_cycle 
    CHECK (billing_cycle IN ('monthly', 'yearly') OR billing_cycle IS NULL);
  END IF;
END $$;

-- Constraint para coherencia de fechas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_period_dates'
  ) THEN
    ALTER TABLE public.user_subscriptions 
    ADD CONSTRAINT chk_period_dates 
    CHECK (current_period_end >= current_period_start OR current_period_start IS NULL OR current_period_end IS NULL);
  END IF;
END $$;

-- Constraint para upsell status
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_upsell_status'
  ) THEN
    ALTER TABLE public.user_active_upsells 
    ADD CONSTRAINT chk_upsell_status 
    CHECK (status IN ('active', 'expired', 'cancelled', 'pending'));
  END IF;
END $$;

-- Constraint para payment status
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_payment_status'
  ) THEN
    ALTER TABLE public.payment_history 
    ADD CONSTRAINT chk_payment_status 
    CHECK (status IN ('succeeded', 'failed', 'pending', 'refunded'));
  END IF;
END $$;

-- Constraint para dispute status
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_dispute_status'
  ) THEN
    ALTER TABLE public.payment_disputes 
    ADD CONSTRAINT chk_dispute_status 
    CHECK (status IN ('warning_needs_response', 'warning_under_review', 'warning_closed', 'needs_response', 'under_review', 'charge_refunded', 'won', 'lost'));
  END IF;
END $$;

-- =====================================================
-- 1.3 TABLA DE AUDITORÍA Y TRIGGERS
-- =====================================================

-- Tabla para auditoría de cambios críticos en suscripciones
CREATE TABLE IF NOT EXISTS public.subscription_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  table_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  changed_by UUID,
  changed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::JSONB
);

-- Índices para auditoría
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.subscription_audit_log(user_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_table ON public.subscription_audit_log(table_name, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.subscription_audit_log(action, changed_at DESC);

-- Habilitar RLS en tabla de auditoría
ALTER TABLE public.subscription_audit_log ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para auditoría
DROP POLICY IF EXISTS "Super admins can view audit log" ON public.subscription_audit_log;
CREATE POLICY "Super admins can view audit log" ON public.subscription_audit_log 
  FOR SELECT USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "System can insert audit logs" ON public.subscription_audit_log;
CREATE POLICY "System can insert audit logs" ON public.subscription_audit_log 
  FOR INSERT WITH CHECK (true);

-- Trigger function para auditoría automática
CREATE OR REPLACE FUNCTION public.audit_subscription_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Determinar user_id según la operación
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
  ELSE
    v_user_id := NEW.user_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.subscription_audit_log (user_id, table_name, action, new_data, changed_by)
    VALUES (v_user_id, TG_TABLE_NAME, 'INSERT', to_jsonb(NEW), auth.uid());
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Solo registrar si hay cambios significativos
    IF OLD.status IS DISTINCT FROM NEW.status 
       OR OLD.plan_id IS DISTINCT FROM NEW.plan_id 
       OR OLD.cancel_at_period_end IS DISTINCT FROM NEW.cancel_at_period_end
       OR OLD.billing_cycle IS DISTINCT FROM NEW.billing_cycle
       OR OLD.current_period_end IS DISTINCT FROM NEW.current_period_end THEN
      INSERT INTO public.subscription_audit_log (user_id, table_name, action, old_data, new_data, changed_by)
      VALUES (v_user_id, TG_TABLE_NAME, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    END IF;
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.subscription_audit_log (user_id, table_name, action, old_data, changed_by)
    VALUES (v_user_id, TG_TABLE_NAME, 'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Aplicar trigger a user_subscriptions
DROP TRIGGER IF EXISTS audit_user_subscriptions ON public.user_subscriptions;
CREATE TRIGGER audit_user_subscriptions
  AFTER INSERT OR UPDATE OR DELETE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.audit_subscription_changes();

-- =====================================================
-- 1.4 FUNCIONES DE MÉTRICAS ENTERPRISE
-- =====================================================

-- Función para calcular MRR (Monthly Recurring Revenue) en tiempo real
CREATE OR REPLACE FUNCTION public.calculate_mrr()
RETURNS TABLE (
  total_mrr NUMERIC,
  mrr_by_plan JSONB,
  active_subscriptions INTEGER,
  average_revenue_per_user NUMERIC,
  yearly_subscribers INTEGER,
  monthly_subscribers INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH active_subs AS (
    SELECT 
      us.id,
      us.billing_cycle,
      sp.name as plan_name,
      sp.display_name,
      CASE 
        WHEN us.billing_cycle = 'yearly' THEN COALESCE(sp.price_yearly, 0) / 12
        ELSE COALESCE(sp.price_monthly, 0)
      END as monthly_value
    FROM public.user_subscriptions us
    JOIN public.subscription_plans sp ON us.plan_id = sp.id
    WHERE us.status = 'active' 
      AND (us.cancel_at_period_end = false OR us.cancel_at_period_end IS NULL)
  ),
  plan_aggregates AS (
    SELECT 
      plan_name,
      display_name,
      COUNT(*) as sub_count,
      SUM(monthly_value) as plan_mrr
    FROM active_subs
    GROUP BY plan_name, display_name
  )
  SELECT 
    COALESCE(SUM(a.monthly_value), 0)::NUMERIC as total_mrr,
    COALESCE(
      (SELECT jsonb_object_agg(
        pa.display_name, 
        jsonb_build_object('count', pa.sub_count, 'mrr', pa.plan_mrr)
      ) FROM plan_aggregates pa),
      '{}'::JSONB
    ) as mrr_by_plan,
    COUNT(*)::INTEGER as active_subscriptions,
    CASE 
      WHEN COUNT(*) > 0 THEN ROUND(SUM(a.monthly_value) / COUNT(*), 2)
      ELSE 0
    END::NUMERIC as average_revenue_per_user,
    COUNT(*) FILTER (WHERE a.billing_cycle = 'yearly')::INTEGER as yearly_subscribers,
    COUNT(*) FILTER (WHERE a.billing_cycle = 'monthly')::INTEGER as monthly_subscribers
  FROM active_subs a;
END;
$$;

-- Función para calcular churn rate preciso
CREATE OR REPLACE FUNCTION public.calculate_churn_rate(p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  churn_rate NUMERIC,
  churned_count INTEGER,
  starting_count INTEGER,
  new_subscriptions INTEGER,
  net_change INTEGER,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_start_date TIMESTAMPTZ;
  v_end_date TIMESTAMPTZ;
  v_churned INTEGER;
  v_starting INTEGER;
  v_new INTEGER;
BEGIN
  v_end_date := NOW();
  v_start_date := v_end_date - (p_days || ' days')::INTERVAL;
  
  -- Contar suscripciones activas al inicio del período
  SELECT COUNT(*) INTO v_starting
  FROM public.user_subscriptions
  WHERE status IN ('active', 'trialing')
    AND created_at < v_start_date;
  
  -- Contar cancelaciones en el período (usando subscription_changes)
  SELECT COUNT(*) INTO v_churned
  FROM public.subscription_changes
  WHERE change_type IN ('cancellation', 'expired', 'suspended')
    AND changed_at >= v_start_date
    AND changed_at <= v_end_date;
  
  -- Si no hay datos en subscription_changes, usar user_subscriptions
  IF v_churned = 0 THEN
    SELECT COUNT(*) INTO v_churned
    FROM public.user_subscriptions
    WHERE status IN ('canceled', 'expired', 'suspended')
      AND updated_at >= v_start_date
      AND updated_at <= v_end_date;
  END IF;
  
  -- Contar nuevas suscripciones en el período
  SELECT COUNT(*) INTO v_new
  FROM public.user_subscriptions
  WHERE status IN ('active', 'trialing')
    AND created_at >= v_start_date
    AND created_at <= v_end_date;
  
  RETURN QUERY
  SELECT 
    CASE WHEN v_starting > 0 
      THEN ROUND((v_churned::NUMERIC / v_starting) * 100, 2)
      ELSE 0::NUMERIC
    END as churn_rate,
    v_churned as churned_count,
    v_starting as starting_count,
    v_new as new_subscriptions,
    (v_new - v_churned) as net_change,
    v_start_date as period_start,
    v_end_date as period_end;
END;
$$;

-- Función para análisis de cohortes de suscripción
CREATE OR REPLACE FUNCTION public.subscription_cohort_analysis(p_months INTEGER DEFAULT 6)
RETURNS TABLE (
  cohort_month TEXT,
  total_subscriptions INTEGER,
  still_active INTEGER,
  month_1_retention NUMERIC,
  month_2_retention NUMERIC,
  month_3_retention NUMERIC,
  month_6_retention NUMERIC,
  avg_revenue NUMERIC,
  ltv_estimate NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH cohorts AS (
    SELECT 
      DATE_TRUNC('month', us.created_at) as cohort_date,
      us.user_id,
      us.id as subscription_id,
      us.status,
      us.created_at,
      sp.price_monthly
    FROM public.user_subscriptions us
    JOIN public.subscription_plans sp ON us.plan_id = sp.id
    WHERE us.created_at >= NOW() - (p_months || ' months')::INTERVAL
  ),
  cohort_stats AS (
    SELECT 
      c.cohort_date,
      COUNT(DISTINCT c.user_id) as total_users,
      COUNT(DISTINCT c.user_id) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM public.user_subscriptions us2 
          WHERE us2.user_id = c.user_id 
            AND us2.status = 'active'
        )
      ) as active_now,
      COUNT(DISTINCT c.user_id) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM public.user_subscriptions us2 
          WHERE us2.user_id = c.user_id 
            AND us2.status = 'active'
            AND us2.created_at <= c.cohort_date + INTERVAL '1 month'
        )
      ) as retained_m1,
      COUNT(DISTINCT c.user_id) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM public.user_subscriptions us2 
          WHERE us2.user_id = c.user_id 
            AND us2.status = 'active'
            AND us2.created_at <= c.cohort_date + INTERVAL '2 months'
        )
      ) as retained_m2,
      COUNT(DISTINCT c.user_id) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM public.user_subscriptions us2 
          WHERE us2.user_id = c.user_id 
            AND us2.status = 'active'
            AND us2.created_at <= c.cohort_date + INTERVAL '3 months'
        )
      ) as retained_m3,
      COUNT(DISTINCT c.user_id) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM public.user_subscriptions us2 
          WHERE us2.user_id = c.user_id 
            AND us2.status = 'active'
            AND us2.created_at <= c.cohort_date + INTERVAL '6 months'
        )
      ) as retained_m6,
      AVG(c.price_monthly) as avg_price
    FROM cohorts c
    GROUP BY c.cohort_date
  )
  SELECT 
    TO_CHAR(cs.cohort_date, 'YYYY-MM') as cohort_month,
    cs.total_users::INTEGER as total_subscriptions,
    cs.active_now::INTEGER as still_active,
    CASE WHEN cs.total_users > 0 
      THEN ROUND((cs.retained_m1::NUMERIC / cs.total_users) * 100, 1)
      ELSE 0 
    END as month_1_retention,
    CASE WHEN cs.total_users > 0 
      THEN ROUND((cs.retained_m2::NUMERIC / cs.total_users) * 100, 1)
      ELSE 0 
    END as month_2_retention,
    CASE WHEN cs.total_users > 0 
      THEN ROUND((cs.retained_m3::NUMERIC / cs.total_users) * 100, 1)
      ELSE 0 
    END as month_3_retention,
    CASE WHEN cs.total_users > 0 
      THEN ROUND((cs.retained_m6::NUMERIC / cs.total_users) * 100, 1)
      ELSE 0 
    END as month_6_retention,
    ROUND(COALESCE(cs.avg_price, 0), 2) as avg_revenue,
    -- LTV estimate: ARPU * estimated lifetime (basado en churn)
    CASE WHEN cs.total_users > 0 AND cs.retained_m3 > 0
      THEN ROUND(
        cs.avg_price * (1.0 / NULLIF(1.0 - (cs.retained_m3::NUMERIC / cs.total_users), 0)),
        0
      )
      ELSE ROUND(cs.avg_price * 12, 0) -- Default: 12 meses de vida
    END as ltv_estimate
  FROM cohort_stats cs
  ORDER BY cs.cohort_date DESC;
END;
$$;

-- =====================================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================
COMMENT ON TABLE public.subscription_audit_log IS 'Registro de auditoría para cambios críticos en suscripciones - Nivel Enterprise';
COMMENT ON FUNCTION public.calculate_mrr() IS 'Calcula MRR total, por plan, y métricas de revenue en tiempo real';
COMMENT ON FUNCTION public.calculate_churn_rate(INTEGER) IS 'Calcula tasa de churn para un período dado en días (default 30)';
COMMENT ON FUNCTION public.subscription_cohort_analysis(INTEGER) IS 'Análisis de cohortes con retención mensual y estimación de LTV';