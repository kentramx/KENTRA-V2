-- Actualizar función para incluir suscripciones canceladas además de activas
DROP FUNCTION IF EXISTS public.get_user_subscription_info(uuid);

CREATE OR REPLACE FUNCTION public.get_user_subscription_info(user_uuid uuid)
 RETURNS TABLE(
   has_subscription boolean, 
   name text, 
   display_name text, 
   features jsonb, 
   status text, 
   current_period_end timestamp with time zone,
   cancel_at_period_end boolean,
   properties_used integer, 
   properties_limit integer, 
   featured_used integer, 
   featured_limit integer
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_reset_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Verificar si necesita reseteo (solo para suscripciones activas)
  SELECT us.featured_reset_date INTO v_reset_date
  FROM user_subscriptions us
  WHERE us.user_id = user_uuid AND us.status = 'active';

  -- Resetear si pasó el mes
  IF v_reset_date IS NOT NULL AND v_reset_date <= NOW() THEN
    UPDATE user_subscriptions
    SET 
      featured_used_this_month = 0,
      featured_reset_date = date_trunc('month', NOW()) + INTERVAL '1 month'
    WHERE user_subscriptions.user_id = user_uuid AND user_subscriptions.status = 'active';
  END IF;

  RETURN QUERY
  SELECT 
    true as has_subscription,
    sp.name,
    sp.display_name,
    sp.features,
    us.status::TEXT,
    us.current_period_end,
    us.cancel_at_period_end,
    (SELECT COUNT(*)::INTEGER FROM properties p WHERE p.agent_id = user_uuid AND p.status = 'activa') as properties_used,
    (sp.features->>'max_properties')::INTEGER as properties_limit,
    COALESCE(us.featured_used_this_month, 0) as featured_used,
    (sp.features->>'featured_listings')::INTEGER as featured_limit
  FROM user_subscriptions us
  JOIN subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = user_uuid 
    AND us.status IN ('active', 'canceled')
  ORDER BY 
    CASE us.status 
      WHEN 'active' THEN 1
      WHEN 'canceled' THEN 2
    END
  LIMIT 1;
END;
$function$;