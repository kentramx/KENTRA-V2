-- MEJORAS A SISTEMA DE UPSELLS Y LÍMITES

-- 1. Agregar campos a tabla upsells para definir su efecto sobre límites
ALTER TABLE public.upsells 
ADD COLUMN IF NOT EXISTS upsell_type TEXT DEFAULT 'other' CHECK (upsell_type IN ('slot_propiedad', 'destacar_propiedad', 'other')),
ADD COLUMN IF NOT EXISTS quantity_per_upsell INTEGER DEFAULT 1;

COMMENT ON COLUMN public.upsells.upsell_type IS 'Tipo de upsell: slot_propiedad (slots adicionales), destacar_propiedad (destacadas), other';

-- 2. Actualizar upsells existentes con su tipo correcto
UPDATE public.upsells 
SET upsell_type = 'slot_propiedad', quantity_per_upsell = 1
WHERE name ILIKE '%slot%' OR name ILIKE '%propiedad adicional%';

UPDATE public.upsells 
SET upsell_type = 'destacar_propiedad', quantity_per_upsell = 1
WHERE name ILIKE '%destacar%' OR name ILIKE '%featured%';

-- 3. Función mejorada que considera upsells activos
CREATE OR REPLACE FUNCTION public.can_create_property_with_upsells(user_uuid uuid)
RETURNS TABLE(can_create boolean, reason text, current_count integer, max_allowed integer, additional_slots integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  user_role app_role;
  base_max_props INTEGER;
  current_props INTEGER;
  sub_status TEXT;
  extra_slots INTEGER := 0;
  total_max INTEGER;
BEGIN
  SELECT role INTO user_role FROM user_roles WHERE user_id = user_uuid LIMIT 1;
  SELECT COUNT(*) INTO current_props FROM properties WHERE agent_id = user_uuid AND status = 'activa';
  
  IF user_role = 'buyer' THEN
    IF current_props < 1 THEN
      RETURN QUERY SELECT true, 'Puedes publicar tu primera propiedad gratis'::TEXT, current_props, 1, 0;
    ELSE
      RETURN QUERY SELECT false, 'Ya tienes 1 propiedad publicada. Conviértete en Agente para publicar más.'::TEXT, current_props, 1, 0;
    END IF;
    RETURN;
  END IF;
  
  IF user_role IN ('agent', 'agency') THEN
    SELECT us.status, (sp.features->>'max_properties')::INTEGER
    INTO sub_status, base_max_props
    FROM user_subscriptions us
    JOIN subscription_plans sp ON sp.id = us.plan_id
    WHERE us.user_id = user_uuid AND us.status IN ('active', 'trialing');
    
    IF sub_status IS NULL THEN
      RETURN QUERY SELECT false, 'Necesitas una suscripción activa para publicar propiedades'::TEXT, current_props, 0, 0;
      RETURN;
    END IF;
    
    -- Calcular slots adicionales de upsells activos
    SELECT COALESCE(SUM(uau.quantity * u.quantity_per_upsell), 0)
    INTO extra_slots
    FROM user_active_upsells uau
    JOIN upsells u ON u.id = uau.upsell_id
    WHERE uau.user_id = user_uuid
      AND uau.status = 'active'
      AND u.upsell_type = 'slot_propiedad'
      AND (uau.end_date IS NULL OR uau.end_date > NOW());
    
    IF base_max_props = -1 THEN
      RETURN QUERY SELECT true, 'Propiedades ilimitadas'::TEXT, current_props, -1, extra_slots;
      RETURN;
    END IF;
    
    total_max := base_max_props + extra_slots;
    
    IF current_props < total_max THEN
      RETURN QUERY SELECT true, format('Puedes publicar %s propiedades más', total_max - current_props)::TEXT, current_props, total_max, extra_slots;
    ELSE
      RETURN QUERY SELECT false, format('Has alcanzado tu límite de %s propiedades', total_max)::TEXT, current_props, total_max, extra_slots;
    END IF;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT false, 'Rol no válido'::TEXT, 0, 0, 0;
END;
$$;