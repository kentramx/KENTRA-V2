-- =====================================================
-- TRIGGER DE SEGURIDAD: Validación de Límites de Propiedades
-- =====================================================
-- Previene que usuarios técnicos bypaseen los límites de propiedades
-- haciendo INSERT directo vía API de Supabase.
-- Consistente con la lógica de can_create_property_with_upsells()
-- =====================================================

-- 1. Función de validación
CREATE OR REPLACE FUNCTION public.check_property_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  user_subscription RECORD;
  additional_slots INTEGER := 0;
  user_role public.app_role;
BEGIN
  -- Solo validar en INSERT, no en UPDATE/DELETE
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Obtener rol del usuario
  SELECT role INTO user_role 
  FROM public.user_roles 
  WHERE user_id = NEW.agent_id 
  LIMIT 1;

  -- Contar propiedades activas actuales del usuario
  SELECT COUNT(*) INTO current_count
  FROM public.properties
  WHERE agent_id = NEW.agent_id
    AND status IN ('activa', 'pendiente_aprobacion', 'en_revision');

  -- Caso: Buyer o sin rol (solo 1 propiedad gratis permitida)
  IF user_role = 'buyer' OR user_role IS NULL THEN
    IF current_count >= 1 THEN
      RAISE EXCEPTION 'Ya tienes 1 propiedad publicada. Conviértete en Agente para publicar más.';
    END IF;
    RETURN NEW;
  END IF;

  -- Caso: Agent/Agency - Obtener suscripción activa
  SELECT us.*, sp.features
  INTO user_subscription
  FROM public.user_subscriptions us
  JOIN public.subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = NEW.agent_id
    AND us.status IN ('active', 'trialing')
  ORDER BY us.created_at DESC
  LIMIT 1;

  -- Sin suscripción activa → bloquear
  IF user_subscription IS NULL THEN
    RAISE EXCEPTION 'No tienes una suscripción activa para publicar propiedades';
  END IF;

  -- Obtener límite del plan desde features JSON
  max_allowed := COALESCE((user_subscription.features->>'max_properties')::INTEGER, 0);
  
  -- Si es ilimitado (-1 o 999+), permitir INSERT
  IF max_allowed = -1 OR max_allowed >= 999 THEN
    RETURN NEW;
  END IF;

  -- Agregar slots adicionales de upsells activos
  SELECT COALESCE(SUM(uau.quantity * COALESCE(u.quantity_per_upsell, 1)), 0) 
  INTO additional_slots
  FROM public.user_active_upsells uau
  JOIN public.upsells u ON u.id = uau.upsell_id
  WHERE uau.user_id = NEW.agent_id
    AND uau.status = 'active'
    AND u.upsell_type = 'slot_propiedad'
    AND (uau.end_date IS NULL OR uau.end_date > NOW());
  
  max_allowed := max_allowed + additional_slots;

  -- Validar límite
  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Has alcanzado el límite de % propiedades de tu plan. Actualiza tu plan o compra slots adicionales.', max_allowed;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- 2. Crear el trigger (eliminar si existe primero)
DROP TRIGGER IF EXISTS enforce_property_limit ON public.properties;

CREATE TRIGGER enforce_property_limit
  BEFORE INSERT ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.check_property_limit();

-- 3. Comentario explicativo
COMMENT ON FUNCTION public.check_property_limit() IS 
'Trigger de seguridad que valida límites de propiedades por plan antes de INSERT.
Considera: rol del usuario, suscripción activa, límite del plan, slots adicionales (upsells).
Previene bypass de validaciones del frontend vía INSERT directo a la API.
Consistente con can_create_property_with_upsells().';