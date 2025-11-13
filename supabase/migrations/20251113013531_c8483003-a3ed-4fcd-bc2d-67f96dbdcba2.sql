-- Función RPC para obtener métricas de churn y retención
CREATE OR REPLACE FUNCTION public.get_churn_metrics(
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '12 months',
  end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  is_super_admin_user BOOLEAN;
BEGIN
  -- Verificar que el usuario es super_admin
  SELECT public.is_super_admin(auth.uid()) INTO is_super_admin_user;
  
  IF NOT is_super_admin_user THEN
    RAISE EXCEPTION 'Solo super_admin puede acceder a métricas de churn';
  END IF;
  
  SELECT json_build_object(
    'churn_rate_monthly', (
      -- Churn rate mensual: cancelaciones / suscripciones activas al inicio del mes
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT 
          date_trunc('month', changed_at) as month,
          COUNT(*) FILTER (WHERE change_type = 'cancellation') as cancellations,
          (
            SELECT COUNT(*)
            FROM user_subscriptions
            WHERE status IN ('active', 'trialing')
              AND created_at <= date_trunc('month', sc.changed_at)
          ) as active_at_start,
          CASE 
            WHEN COUNT(*) FILTER (WHERE change_type = 'cancellation') > 0 THEN
              ROUND(
                (COUNT(*) FILTER (WHERE change_type = 'cancellation')::NUMERIC / 
                NULLIF((SELECT COUNT(*) FROM user_subscriptions WHERE status IN ('active', 'trialing') AND created_at <= date_trunc('month', sc.changed_at)), 0)::NUMERIC) * 100, 
                2
              )
            ELSE 0
          END as churn_rate
        FROM subscription_changes sc
        WHERE sc.changed_at >= start_date
          AND sc.changed_at <= end_date
        GROUP BY date_trunc('month', changed_at)
        ORDER BY month DESC
      ) t
    ),
    'retention_rate_monthly', (
      -- Retention rate: usuarios que renovaron / usuarios que podían renovar
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT 
          date_trunc('month', ph.created_at) as month,
          COUNT(DISTINCT ph.user_id) as renewed_users,
          (
            SELECT COUNT(DISTINCT user_id)
            FROM user_subscriptions
            WHERE current_period_end >= date_trunc('month', ph.created_at)
              AND current_period_end < date_trunc('month', ph.created_at) + INTERVAL '1 month'
          ) as eligible_for_renewal,
          CASE 
            WHEN COUNT(DISTINCT ph.user_id) > 0 THEN
              ROUND(
                (COUNT(DISTINCT ph.user_id)::NUMERIC / 
                NULLIF((SELECT COUNT(DISTINCT user_id) FROM user_subscriptions WHERE current_period_end >= date_trunc('month', ph.created_at) AND current_period_end < date_trunc('month', ph.created_at) + INTERVAL '1 month'), 0)::NUMERIC) * 100,
                2
              )
            ELSE 0
          END as retention_rate
        FROM payment_history ph
        WHERE ph.status = 'succeeded'
          AND ph.payment_type = 'subscription'
          AND ph.created_at >= start_date
          AND ph.created_at <= end_date
        GROUP BY date_trunc('month', ph.created_at)
        ORDER BY month DESC
      ) t
    ),
    'cohort_analysis', (
      -- Análisis de cohortes: usuarios por mes de registro y cuántos permanecen activos
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT 
          date_trunc('month', us.created_at) as cohort_month,
          COUNT(DISTINCT us.user_id) as total_users,
          COUNT(DISTINCT us.user_id) FILTER (WHERE us.status IN ('active', 'trialing')) as active_now,
          ROUND(
            (COUNT(DISTINCT us.user_id) FILTER (WHERE us.status IN ('active', 'trialing'))::NUMERIC / 
            COUNT(DISTINCT us.user_id)::NUMERIC) * 100,
            2
          ) as retention_percentage
        FROM user_subscriptions us
        WHERE us.created_at >= start_date
          AND us.created_at <= end_date
        GROUP BY date_trunc('month', us.created_at)
        ORDER BY cohort_month DESC
        LIMIT 12
      ) t
    ),
    'ltv_analysis', (
      -- Lifetime Value promedio por plan
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT 
          sp.display_name as plan_name,
          COUNT(DISTINCT ph.user_id) as total_customers,
          ROUND(AVG(total_revenue.revenue), 2) as avg_ltv,
          ROUND(SUM(total_revenue.revenue), 2) as total_revenue
        FROM subscription_plans sp
        LEFT JOIN user_subscriptions us ON us.plan_id = sp.id
        LEFT JOIN LATERAL (
          SELECT 
            ph.user_id,
            SUM(ph.amount) as revenue
          FROM payment_history ph
          WHERE ph.user_id = us.user_id
            AND ph.status = 'succeeded'
          GROUP BY ph.user_id
        ) total_revenue ON true
        WHERE us.created_at >= start_date
          AND us.created_at <= end_date
        GROUP BY sp.display_name
        ORDER BY avg_ltv DESC NULLS LAST
      ) t
    ),
    'cancellation_reasons', (
      -- Top razones de cancelación (del metadata de subscription_changes)
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT 
          COALESCE(metadata->>'cancellation_reason', 'No especificada') as reason,
          COUNT(*) as count,
          ROUND((COUNT(*)::NUMERIC / (SELECT COUNT(*) FROM subscription_changes WHERE change_type = 'cancellation' AND changed_at >= start_date AND changed_at <= end_date)::NUMERIC) * 100, 2) as percentage
        FROM subscription_changes
        WHERE change_type = 'cancellation'
          AND changed_at >= start_date
          AND changed_at <= end_date
        GROUP BY metadata->>'cancellation_reason'
        ORDER BY count DESC
        LIMIT 10
      ) t
    ),
    'summary', (
      SELECT json_build_object(
        'total_active_subscriptions', (
          SELECT COUNT(*) FROM user_subscriptions WHERE status IN ('active', 'trialing')
        ),
        'total_canceled_all_time', (
          SELECT COUNT(*) FROM user_subscriptions WHERE status = 'canceled'
        ),
        'total_cancellations_period', (
          SELECT COUNT(*) FROM subscription_changes 
          WHERE change_type = 'cancellation' 
            AND changed_at >= start_date 
            AND changed_at <= end_date
        ),
        'overall_churn_rate', (
          SELECT ROUND(
            (COUNT(*) FILTER (WHERE status = 'canceled')::NUMERIC / 
            NULLIF(COUNT(*)::NUMERIC, 0)) * 100,
            2
          )
          FROM user_subscriptions
          WHERE created_at >= start_date
        ),
        'avg_customer_lifetime_months', (
          SELECT ROUND(AVG(
            EXTRACT(EPOCH FROM (
              COALESCE(
                (SELECT MAX(changed_at) FROM subscription_changes WHERE subscription_changes.user_id = us.user_id AND change_type = 'cancellation'),
                NOW()
              ) - us.created_at
            )) / (30 * 24 * 60 * 60)
          ), 1)
          FROM user_subscriptions us
          WHERE us.created_at >= start_date
        ),
        'avg_revenue_per_customer', (
          SELECT ROUND(AVG(total_revenue), 2)
          FROM (
            SELECT SUM(amount) as total_revenue
            FROM payment_history
            WHERE status = 'succeeded'
              AND created_at >= start_date
              AND created_at <= end_date
            GROUP BY user_id
          ) t
        )
      )
    )
  ) INTO result;
  
  RETURN result;
END;
$$;