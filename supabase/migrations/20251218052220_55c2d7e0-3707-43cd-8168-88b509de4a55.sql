
-- Fix trigger function to use valid enum values only
CREATE OR REPLACE FUNCTION public.check_property_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  user_subscription RECORD;
  additional_slots INTEGER := 0;
  user_role public.app_role;
BEGIN
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  SELECT role INTO user_role 
  FROM public.user_roles 
  WHERE user_id = NEW.agent_id 
  LIMIT 1;

  SELECT COUNT(*) INTO current_count
  FROM public.properties
  WHERE agent_id = NEW.agent_id
    AND status IN ('activa', 'pendiente_aprobacion');

  IF user_role = 'buyer' OR user_role IS NULL THEN
    IF current_count >= 1 THEN
      RAISE EXCEPTION 'Ya tienes 1 propiedad publicada. Conviértete en Agente para publicar más.';
    END IF;
    RETURN NEW;
  END IF;

  SELECT us.*, sp.features
  INTO user_subscription
  FROM public.user_subscriptions us
  JOIN public.subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = NEW.agent_id
    AND us.status IN ('active', 'trialing')
  ORDER BY us.created_at DESC
  LIMIT 1;

  IF user_subscription IS NULL THEN
    RAISE EXCEPTION 'No tienes una suscripción activa para publicar propiedades';
  END IF;

  max_allowed := COALESCE((user_subscription.features->>'max_properties')::INTEGER, 0);
  
  IF max_allowed = -1 OR max_allowed >= 999 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(uau.quantity * COALESCE(u.quantity_per_upsell, 1)), 0) 
  INTO additional_slots
  FROM public.user_active_upsells uau
  JOIN public.upsells u ON u.id = uau.upsell_id
  WHERE uau.user_id = NEW.agent_id
    AND uau.status = 'active'
    AND u.upsell_type = 'slot_propiedad'
    AND (uau.end_date IS NULL OR uau.end_date > NOW());
  
  max_allowed := max_allowed + additional_slots;

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Has alcanzado el límite de % propiedades de tu plan.', max_allowed;
  END IF;

  RETURN NEW;
END;
$$;
