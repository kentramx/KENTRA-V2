-- ============================================
-- SUPABASE FUNCTIONS PATCH - Kentra
-- Fecha: 2026-01-17
-- Propósito: Agregar funciones y triggers faltantes
-- ============================================

-- ============================================
-- 1. FUNCIÓN: get_avg_review_time_minutes
-- Calcula el tiempo promedio de revisión de propiedades
-- ============================================
CREATE OR REPLACE FUNCTION public.get_avg_review_time_minutes()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  avg_minutes NUMERIC;
BEGIN
  -- Calcular promedio de tiempo entre creación y revisión
  -- Usa properties con status approved/rejected en los últimos 30 días
  SELECT ROUND(
    AVG(
      EXTRACT(EPOCH FROM (p.updated_at - p.created_at)) / 60
    )::NUMERIC, 
    2
  )
  INTO avg_minutes
  FROM properties p
  WHERE p.status IN ('approved', 'rejected')
    AND p.updated_at >= NOW() - INTERVAL '30 days'
    AND p.updated_at > p.created_at;

  RETURN COALESCE(avg_minutes, 0);
END;
$$;

-- ============================================
-- 2. FUNCIÓN: get_moderation_stats
-- Retorna estadísticas de moderación para dashboard admin
-- ============================================
CREATE OR REPLACE FUNCTION public.get_moderation_stats()
RETURNS TABLE(
  pending_count BIGINT,
  approved_today BIGINT,
  rejected_today BIGINT,
  avg_review_minutes NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Propiedades pendientes de revisión
    (SELECT COUNT(*) FROM properties WHERE status = 'pending')::BIGINT AS pending_count,
    
    -- Aprobadas hoy
    (SELECT COUNT(*) FROM properties 
     WHERE status = 'approved' 
     AND updated_at::DATE = CURRENT_DATE)::BIGINT AS approved_today,
    
    -- Rechazadas hoy
    (SELECT COUNT(*) FROM properties 
     WHERE status = 'rejected' 
     AND updated_at::DATE = CURRENT_DATE)::BIGINT AS rejected_today,
    
    -- Tiempo promedio de revisión
    public.get_avg_review_time_minutes() AS avg_review_minutes;
END;
$$;

-- ============================================
-- 3. FUNCIÓN: refresh_agent_performance_stats
-- Refresca la vista materializada de rendimiento de agentes
-- ============================================
CREATE OR REPLACE FUNCTION public.refresh_agent_performance_stats()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Refrescar concurrentemente (requiere índice único)
  REFRESH MATERIALIZED VIEW CONCURRENTLY agent_performance_stats;
EXCEPTION
  WHEN OTHERS THEN
    -- Si falla el refresh concurrente, intentar refresh normal
    REFRESH MATERIALIZED VIEW agent_performance_stats;
END;
$$;

-- ============================================
-- 4. TRIGGER: update_user_subscriptions_updated_at
-- Actualiza automáticamente updated_at en cada UPDATE
-- ============================================

-- Primero crear la función del trigger
CREATE OR REPLACE FUNCTION public.update_subscription_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Eliminar trigger si existe para evitar duplicados
DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;

-- Crear el trigger
CREATE TRIGGER update_user_subscriptions_updated_at
BEFORE UPDATE ON user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_subscription_updated_at();

-- ============================================
-- 5. VERIFICACIÓN FINAL
-- ============================================
DO $$
DECLARE
  missing_components TEXT[] := ARRAY[]::TEXT[];
  test_result RECORD;
BEGIN
  -- Verificar función get_avg_review_time_minutes
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_avg_review_time_minutes'
  ) THEN
    missing_components := array_append(missing_components, 'get_avg_review_time_minutes');
  END IF;

  -- Verificar función get_moderation_stats
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_moderation_stats'
  ) THEN
    missing_components := array_append(missing_components, 'get_moderation_stats');
  END IF;

  -- Verificar función refresh_agent_performance_stats
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'refresh_agent_performance_stats'
  ) THEN
    missing_components := array_append(missing_components, 'refresh_agent_performance_stats');
  END IF;

  -- Verificar función update_subscription_updated_at
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'update_subscription_updated_at'
  ) THEN
    missing_components := array_append(missing_components, 'update_subscription_updated_at');
  END IF;

  -- Verificar trigger
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'user_subscriptions' 
    AND t.tgname = 'update_user_subscriptions_updated_at'
  ) THEN
    missing_components := array_append(missing_components, 'trigger: update_user_subscriptions_updated_at');
  END IF;

  -- Reportar resultados
  IF array_length(missing_components, 1) > 0 THEN
    RAISE WARNING '⚠️ Componentes faltantes: %', array_to_string(missing_components, ', ');
  ELSE
    RAISE NOTICE '✅ PATCH APLICADO EXITOSAMENTE - Todas las funciones y triggers creados correctamente';
    
    -- Test rápido de las funciones
    RAISE NOTICE '📊 Test get_avg_review_time_minutes(): %', public.get_avg_review_time_minutes();
    
    SELECT * INTO test_result FROM public.get_moderation_stats();
    RAISE NOTICE '📊 Test get_moderation_stats(): pending=%, approved_today=%, rejected_today=%', 
      test_result.pending_count, test_result.approved_today, test_result.rejected_today;
  END IF;
END;
$$;

-- ============================================
-- NOTAS DE USO
-- ============================================
-- 
-- Para ejecutar este script:
-- 1. Ir a Supabase Dashboard > SQL Editor
-- 2. Copiar y pegar todo el contenido
-- 3. Ejecutar (Run)
-- 4. Verificar el mensaje de éxito en los logs
--
-- Tests manuales:
-- SELECT get_avg_review_time_minutes();
-- SELECT * FROM get_moderation_stats();
-- SELECT refresh_agent_performance_stats();
--
-- Para verificar el trigger:
-- UPDATE user_subscriptions SET status = status WHERE id = 'some-id';
-- SELECT updated_at FROM user_subscriptions WHERE id = 'some-id';
-- ============================================
