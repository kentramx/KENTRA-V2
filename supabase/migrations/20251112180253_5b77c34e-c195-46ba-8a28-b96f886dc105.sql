-- PASO 1: Agregar campos de tracking mensual a user_subscriptions
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS featured_used_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS featured_reset_date TIMESTAMP WITH TIME ZONE DEFAULT (date_trunc('month', NOW()) + INTERVAL '1 month');

-- Crear índice para optimizar queries
CREATE INDEX IF NOT EXISTS idx_featured_reset_date ON user_subscriptions(featured_reset_date);

-- PASO 2: Función de validación RPC
CREATE OR REPLACE FUNCTION public.can_feature_property(user_uuid UUID)
RETURNS TABLE(
  can_feature BOOLEAN,
  reason TEXT,
  featured_used INTEGER,
  featured_limit INTEGER,
  plan_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_featured_limit INTEGER;
  v_featured_used INTEGER;
  v_plan_name TEXT;
  v_reset_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Obtener información de suscripción
  SELECT 
    (sp.features->>'featured_listings')::INTEGER,
    COALESCE(us.featured_used_this_month, 0),
    sp.display_name,
    us.featured_reset_date
  INTO v_featured_limit, v_featured_used, v_plan_name, v_reset_date
  FROM user_subscriptions us
  JOIN subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = user_uuid 
    AND us.status = 'active';

  -- Si no tiene suscripción activa
  IF v_featured_limit IS NULL THEN
    RETURN QUERY SELECT 
      false, 
      'No tienes una suscripción activa'::TEXT,
      0,
      0,
      ''::TEXT;
    RETURN;
  END IF;

  -- Validar si necesita reseteo (pasó el mes)
  IF v_reset_date IS NOT NULL AND v_reset_date <= NOW() THEN
    -- Resetear contador
    UPDATE user_subscriptions
    SET 
      featured_used_this_month = 0,
      featured_reset_date = date_trunc('month', NOW()) + INTERVAL '1 month'
    WHERE user_id = user_uuid AND status = 'active';
    
    v_featured_used := 0;
  END IF;

  -- Verificar si puede destacar
  IF v_featured_used < v_featured_limit THEN
    RETURN QUERY SELECT 
      true,
      format('Puedes destacar %s propiedades más este mes', v_featured_limit - v_featured_used),
      v_featured_used,
      v_featured_limit,
      v_plan_name;
  ELSE
    RETURN QUERY SELECT 
      false,
      format('Has usado tus %s destacadas de este mes. Se resetea el %s', 
             v_featured_limit, 
             to_char(v_reset_date, 'DD/MM/YYYY')),
      v_featured_used,
      v_featured_limit,
      v_plan_name;
  END IF;
END;
$$;

-- PASO 3: Trigger de incremento automático
CREATE OR REPLACE FUNCTION public.increment_featured_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Incrementar contador mensual
  UPDATE user_subscriptions
  SET featured_used_this_month = COALESCE(featured_used_this_month, 0) + 1
  WHERE user_id = NEW.agent_id 
    AND status = 'active';
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_increment_featured_count ON featured_properties;
CREATE TRIGGER trigger_increment_featured_count
AFTER INSERT ON featured_properties
FOR EACH ROW
EXECUTE FUNCTION increment_featured_count();

-- PASO 4: Actualizar get_user_subscription_info()
CREATE OR REPLACE FUNCTION public.get_user_subscription_info(user_uuid uuid)
RETURNS TABLE(
  has_subscription boolean, 
  plan_name text, 
  plan_display_name text, 
  features jsonb, 
  status text, 
  current_period_end timestamp with time zone, 
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
  -- Verificar si necesita reseteo
  SELECT us.featured_reset_date INTO v_reset_date
  FROM user_subscriptions us
  WHERE us.user_id = user_uuid AND us.status = 'active';

  -- Resetear si pasó el mes
  IF v_reset_date IS NOT NULL AND v_reset_date <= NOW() THEN
    UPDATE user_subscriptions
    SET 
      featured_used_this_month = 0,
      featured_reset_date = date_trunc('month', NOW()) + INTERVAL '1 month'
    WHERE user_id = user_uuid AND status = 'active';
  END IF;

  RETURN QUERY
  SELECT 
    true as has_subscription,
    sp.name,
    sp.display_name,
    sp.features,
    us.status,
    us.current_period_end,
    (SELECT COUNT(*)::INTEGER FROM properties WHERE agent_id = user_uuid AND status = 'activa') as properties_used,
    (sp.features->>'max_properties')::INTEGER as properties_limit,
    COALESCE(us.featured_used_this_month, 0) as featured_used,
    (sp.features->>'featured_listings')::INTEGER as featured_limit
  FROM user_subscriptions us
  JOIN subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = user_uuid AND us.status = 'active'
  LIMIT 1;
END;
$function$;