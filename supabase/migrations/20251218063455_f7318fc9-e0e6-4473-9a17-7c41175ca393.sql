-- =====================================================
-- ELIMINAR SISTEMA DE BUMPS (IMPULSOS MANUALES)
-- =====================================================

-- 1. Eliminar tabla de logs de bumps
DROP TABLE IF EXISTS property_bump_log CASCADE;

-- 2. Eliminar columnas de bumps de user_subscriptions
ALTER TABLE user_subscriptions 
DROP COLUMN IF EXISTS bumps_used_this_month,
DROP COLUMN IF EXISTS bumps_reset_date;

-- 3. Eliminar función RPC de bump
DROP FUNCTION IF EXISTS bump_property(UUID);

-- 4. Eliminar campo bumps_per_month de features de todos los planes
UPDATE subscription_plans 
SET features = features #- '{limits,bumps_per_month}'
WHERE features->'limits' ? 'bumps_per_month';