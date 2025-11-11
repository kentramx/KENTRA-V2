-- Actualizar función get_marketing_metrics para manejar correctamente datos vacíos
CREATE OR REPLACE FUNCTION public.get_marketing_metrics(
  start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  end_date TIMESTAMPTZ DEFAULT NOW()
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
    RAISE EXCEPTION 'Solo super_admin puede acceder a métricas de marketing';
  END IF;
  
  SELECT json_build_object(
    'total_events', (
      SELECT COUNT(*) 
      FROM conversion_events 
      WHERE created_at BETWEEN start_date AND end_date
    ),
    'conversions', (
      SELECT COUNT(*) 
      FROM conversion_events 
      WHERE event_type IN ('Purchase', 'CompleteRegistration') 
        AND created_at BETWEEN start_date AND end_date
    ),
    'total_value', (
      SELECT COALESCE(SUM(value), 0) 
      FROM conversion_events 
      WHERE created_at BETWEEN start_date AND end_date
    ),
    'events_by_type', COALESCE((
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT event_type, COUNT(*) as count, COALESCE(SUM(value), 0) as total_value
        FROM conversion_events
        WHERE created_at BETWEEN start_date AND end_date
        GROUP BY event_type
        ORDER BY count DESC
      ) t
    ), '[]'::json),
    'daily_trend', COALESCE((
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as total_events,
          COUNT(*) FILTER (WHERE event_type IN ('Purchase', 'CompleteRegistration')) as conversions,
          COALESCE(SUM(value), 0) as total_value
        FROM conversion_events
        WHERE created_at BETWEEN start_date AND end_date
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      ) t
    ), '[]'::json),
    'funnel_data', (
      SELECT json_build_object(
        'view_content', (SELECT COUNT(*) FROM conversion_events WHERE event_type = 'ViewContent' AND created_at BETWEEN start_date AND end_date),
        'initiate_checkout', (SELECT COUNT(*) FROM conversion_events WHERE event_type = 'InitiateCheckout' AND created_at BETWEEN start_date AND end_date),
        'purchase', (SELECT COUNT(*) FROM conversion_events WHERE event_type = 'Purchase' AND created_at BETWEEN start_date AND end_date)
      )
    )
  ) INTO result;
  
  RETURN result;
END;
$$;