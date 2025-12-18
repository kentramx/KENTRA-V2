-- =============================================
-- SISTEMA DE RENOVACIÓN UNIVERSAL + IMPULSOS
-- =============================================

-- 1. Agregar campos de impulsos a user_subscriptions
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS bumps_used_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS bumps_reset_date TIMESTAMPTZ DEFAULT (date_trunc('month', now()) + INTERVAL '1 month');

-- 2. Crear tabla de log de impulsos para auditoría
CREATE TABLE IF NOT EXISTS property_bump_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  bumped_at TIMESTAMPTZ DEFAULT now(),
  previous_last_renewed_at TIMESTAMPTZ,
  bump_type TEXT DEFAULT 'manual' CHECK (bump_type IN ('manual', 'automatic')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_property_bump_log_user_id ON property_bump_log(user_id);
CREATE INDEX IF NOT EXISTS idx_property_bump_log_property_id ON property_bump_log(property_id);
CREATE INDEX IF NOT EXISTS idx_property_bump_log_bumped_at ON property_bump_log(bumped_at DESC);

-- RLS para property_bump_log
ALTER TABLE property_bump_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bump logs" ON property_bump_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert bump logs" ON property_bump_log
  FOR INSERT WITH CHECK (true);

-- 3. Actualizar features.limits de planes existentes con bumps_per_month
-- Trial: 0 impulsos
UPDATE subscription_plans 
SET features = jsonb_set(
  features,
  '{limits,bumps_per_month}',
  '0'::jsonb
)
WHERE name LIKE '%trial%';

-- Start/Básico: 3 impulsos
UPDATE subscription_plans 
SET features = jsonb_set(
  features,
  '{limits,bumps_per_month}',
  '3'::jsonb
)
WHERE name LIKE '%start%' OR name LIKE '%basico%' OR name LIKE '%básico%';

-- Pro: 10 impulsos
UPDATE subscription_plans 
SET features = jsonb_set(
  features,
  '{limits,bumps_per_month}',
  '10'::jsonb
)
WHERE name LIKE '%pro%' AND name NOT LIKE '%elite%';

-- Elite/Premium: -1 = ilimitado
UPDATE subscription_plans 
SET features = jsonb_set(
  features,
  '{limits,bumps_per_month}',
  '-1'::jsonb
)
WHERE name LIKE '%elite%' OR name LIKE '%premium%';

-- 4. Crear función RPC para bump manual
CREATE OR REPLACE FUNCTION bump_property(property_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_property RECORD;
  v_subscription RECORD;
  v_bumps_limit INTEGER;
  v_current_bumps INTEGER;
  v_previous_renewed TIMESTAMPTZ;
BEGIN
  -- Obtener usuario autenticado
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
  END IF;

  -- Verificar propiedad existe y pertenece al usuario
  SELECT * INTO v_property 
  FROM properties 
  WHERE id = property_id AND agent_id = v_user_id;
  
  IF v_property IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Propiedad no encontrada');
  END IF;

  IF v_property.status != 'activa' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo se pueden impulsar propiedades activas');
  END IF;

  -- Obtener suscripción activa con límites
  SELECT us.*, sp.features
  INTO v_subscription
  FROM user_subscriptions us
  JOIN subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = v_user_id
    AND us.status IN ('active', 'trialing')
  ORDER BY us.created_at DESC
  LIMIT 1;

  IF v_subscription IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sin suscripción activa');
  END IF;

  -- Leer límite de bumps (estructura anidada con fallback)
  v_bumps_limit := COALESCE(
    (v_subscription.features->'limits'->>'bumps_per_month')::INTEGER,
    0
  );

  -- Verificar si necesita reset mensual
  IF v_subscription.bumps_reset_date IS NOT NULL AND v_subscription.bumps_reset_date <= NOW() THEN
    UPDATE user_subscriptions
    SET bumps_used_this_month = 0,
        bumps_reset_date = date_trunc('month', NOW()) + INTERVAL '1 month'
    WHERE id = v_subscription.id;
    v_current_bumps := 0;
  ELSE
    v_current_bumps := COALESCE(v_subscription.bumps_used_this_month, 0);
  END IF;

  -- Verificar límite (-1 = ilimitado)
  IF v_bumps_limit != -1 AND v_current_bumps >= v_bumps_limit THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Sin impulsos disponibles este mes',
      'bumps_used', v_current_bumps,
      'bumps_limit', v_bumps_limit,
      'next_reset', v_subscription.bumps_reset_date
    );
  END IF;

  -- Guardar fecha anterior para log
  v_previous_renewed := v_property.last_renewed_at;

  -- Actualizar propiedad
  UPDATE properties
  SET last_renewed_at = NOW(),
      expires_at = NOW() + INTERVAL '33 days',
      updated_at = NOW()
  WHERE id = property_id;

  -- Incrementar contador de bumps
  UPDATE user_subscriptions
  SET bumps_used_this_month = COALESCE(bumps_used_this_month, 0) + 1,
      updated_at = NOW()
  WHERE id = v_subscription.id;

  -- Registrar en log
  INSERT INTO property_bump_log (property_id, user_id, previous_last_renewed_at, bump_type)
  VALUES (property_id, v_user_id, v_previous_renewed, 'manual');

  RETURN jsonb_build_object(
    'success', true,
    'bumps_used', v_current_bumps + 1,
    'bumps_limit', v_bumps_limit,
    'bumps_remaining', CASE WHEN v_bumps_limit = -1 THEN -1 ELSE v_bumps_limit - (v_current_bumps + 1) END,
    'next_reset', v_subscription.bumps_reset_date,
    'new_expires_at', NOW() + INTERVAL '33 days'
  );
END;
$$;

-- 5. Crear función RPC para refresh mensual universal (llamada por cron)
CREATE OR REPLACE FUNCTION refresh_all_active_properties()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_refreshed INTEGER := 0;
  v_total_users INTEGER := 0;
  v_user_record RECORD;
  v_properties_refreshed INTEGER;
BEGIN
  -- Iterar usuarios con suscripción activa
  FOR v_user_record IN 
    SELECT DISTINCT us.user_id
    FROM user_subscriptions us
    WHERE us.status IN ('active', 'trialing')
  LOOP
    -- Actualizar todas las propiedades activas del usuario
    WITH updated AS (
      UPDATE properties
      SET last_renewed_at = NOW(),
          expires_at = NOW() + INTERVAL '33 days',
          updated_at = NOW()
      WHERE agent_id = v_user_record.user_id
        AND status = 'activa'
      RETURNING id, last_renewed_at AS previous_renewed
    ),
    logged AS (
      INSERT INTO property_bump_log (property_id, user_id, previous_last_renewed_at, bump_type)
      SELECT id, v_user_record.user_id, previous_renewed, 'automatic'
      FROM updated
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_properties_refreshed FROM updated;

    IF v_properties_refreshed > 0 THEN
      v_total_refreshed := v_total_refreshed + v_properties_refreshed;
      v_total_users := v_total_users + 1;
    END IF;

    -- Resetear bumps usados del mes
    UPDATE user_subscriptions
    SET bumps_used_this_month = 0,
        bumps_reset_date = date_trunc('month', NOW()) + INTERVAL '1 month',
        updated_at = NOW()
    WHERE user_id = v_user_record.user_id
      AND status IN ('active', 'trialing');
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'total_properties_refreshed', v_total_refreshed,
    'total_users_processed', v_total_users,
    'executed_at', NOW()
  );
END;
$$;