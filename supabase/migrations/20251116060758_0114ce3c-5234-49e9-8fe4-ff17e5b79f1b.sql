-- Corregir función can_create_property que usa nombres de planes inválidos
CREATE OR REPLACE FUNCTION public.can_create_property(user_uuid uuid)
RETURNS TABLE(can_create boolean, reason text, current_count integer, max_allowed integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_role app_role;
  plan_name TEXT;
  max_props INTEGER;
  current_props INTEGER;
  sub_status TEXT;
  trial_created_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Obtener rol del usuario
  SELECT role INTO user_role FROM user_roles WHERE user_id = user_uuid LIMIT 1;
  
  -- Contar propiedades activas actuales
  SELECT COUNT(*) INTO current_props FROM properties WHERE agent_id = user_uuid AND status = 'activa';
  
  -- CASO 1: Buyer (particular) - 1 propiedad gratis
  IF user_role = 'buyer' THEN
    max_props := 1;
    IF current_props < max_props THEN
      RETURN QUERY SELECT true, 'Puedes publicar tu primera propiedad gratis'::TEXT, current_props, max_props;
    ELSE
      RETURN QUERY SELECT false, 'Ya tienes 1 propiedad publicada. Conviértete en Agente para publicar más.'::TEXT, current_props, max_props;
    END IF;
    RETURN;
  END IF;
  
  -- CASO 2: Agent o Agency - requiere suscripción
  IF user_role IN ('agent', 'agency') THEN
    -- Verificar suscripción activa
    SELECT 
      us.status,
      (sp.features->>'max_properties')::INTEGER,
      us.created_at,
      sp.name
    INTO sub_status, max_props, trial_created_at, plan_name
    FROM user_subscriptions us
    JOIN subscription_plans sp ON sp.id = us.plan_id
    WHERE us.user_id = user_uuid AND us.status IN ('active', 'expired');
    
    -- Sin suscripción
    IF sub_status IS NULL THEN
      RETURN QUERY SELECT false, 'Necesitas una suscripción activa para publicar propiedades'::TEXT, current_props, 0;
      RETURN;
    END IF;
    
    -- VALIDACIÓN: Trial expirado
    IF sub_status = 'expired' THEN
      RETURN QUERY SELECT false, 'Tu período de prueba gratuito de 14 días ha expirado. Contrata un plan para seguir publicando.'::TEXT, current_props, 0;
      RETURN;
    END IF;
    
    -- Verificar si es trial y si ya pasaron 14 días (validación adicional por nombre de plan)
    IF plan_name ILIKE '%trial%' AND trial_created_at IS NOT NULL THEN
      IF trial_created_at < NOW() - INTERVAL '14 days' THEN
        RETURN QUERY SELECT false, 'Tu período de prueba gratuito de 14 días ha expirado. Contrata un plan para seguir publicando.'::TEXT, current_props, 0;
        RETURN;
      END IF;
    END IF;
    
    -- Ilimitado (-1)
    IF max_props = -1 THEN
      RETURN QUERY SELECT true, 'Propiedades ilimitadas'::TEXT, current_props, max_props;
      RETURN;
    END IF;
    
    -- Con límite
    IF current_props < max_props THEN
      RETURN QUERY SELECT true, format('Puedes publicar %s propiedades más', max_props - current_props), current_props, max_props;
    ELSE
      RETURN QUERY SELECT false, 'Has alcanzado el límite de propiedades de tu plan'::TEXT, current_props, max_props;
    END IF;
    RETURN;
  END IF;
  
  -- Default: no permitir
  RETURN QUERY SELECT false, 'Rol no válido'::TEXT, 0, 0;
END;
$$;