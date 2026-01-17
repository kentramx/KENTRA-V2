-- ============================================
-- KENTRA - PATCH FINAL DE BASE DE DATOS
-- Fecha: 2026-01-17
-- Propósito: Agregar TODOS los componentes faltantes
-- ============================================

-- ============================================
-- 1. EXTENSIÓN pg_trgm (Búsqueda Fuzzy)
-- ============================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- 2. FUNCIÓN: get_avg_review_time_minutes
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
-- 3. FUNCIÓN: get_moderation_stats
-- Estadísticas de moderación para dashboard admin
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
    (SELECT COUNT(*) FROM properties WHERE status = 'pending')::BIGINT AS pending_count,
    (SELECT COUNT(*) FROM properties 
     WHERE status = 'approved' 
     AND updated_at::DATE = CURRENT_DATE)::BIGINT AS approved_today,
    (SELECT COUNT(*) FROM properties 
     WHERE status = 'rejected' 
     AND updated_at::DATE = CURRENT_DATE)::BIGINT AS rejected_today,
    public.get_avg_review_time_minutes() AS avg_review_minutes;
END;
$$;

-- ============================================
-- 4. FUNCIÓN: refresh_agent_performance_stats
-- Refresca vista materializada de rendimiento
-- ============================================
CREATE OR REPLACE FUNCTION public.refresh_agent_performance_stats()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY agent_performance_stats;
EXCEPTION
  WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW agent_performance_stats;
END;
$$;

-- ============================================
-- 5. FUNCIÓN TRIGGER: update_property_geometry
-- Actualiza geom automáticamente cuando cambian lat/lng
-- ============================================
CREATE OR REPLACE FUNCTION public.update_property_geometry()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
  ELSE
    NEW.geom := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================
-- 6. FUNCIÓN TRIGGER: update_subscription_updated_at
-- Actualiza updated_at automáticamente
-- ============================================
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

-- ============================================
-- 7. TRIGGERS
-- ============================================

-- Trigger para user_subscriptions
DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at
BEFORE UPDATE ON user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_subscription_updated_at();

-- Trigger para properties (geometría)
DROP TRIGGER IF EXISTS update_property_geom ON properties;
CREATE TRIGGER update_property_geom
BEFORE INSERT OR UPDATE OF lat, lng ON properties
FOR EACH ROW
EXECUTE FUNCTION public.update_property_geometry();

-- ============================================
-- 8. VERIFICACIÓN FINAL
-- ============================================
DO $$
DECLARE
  missing_components TEXT[] := ARRAY[]::TEXT[];
  component_count INTEGER := 0;
BEGIN
  -- Verificar extensión pg_trgm
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    missing_components := array_append(missing_components, 'pg_trgm extension');
  ELSE
    component_count := component_count + 1;
  END IF;

  -- Verificar función get_avg_review_time_minutes
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_avg_review_time_minutes'
  ) THEN
    missing_components := array_append(missing_components, 'get_avg_review_time_minutes()');
  ELSE
    component_count := component_count + 1;
  END IF;

  -- Verificar función get_moderation_stats
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_moderation_stats'
  ) THEN
    missing_components := array_append(missing_components, 'get_moderation_stats()');
  ELSE
    component_count := component_count + 1;
  END IF;

  -- Verificar función refresh_agent_performance_stats
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'refresh_agent_performance_stats'
  ) THEN
    missing_components := array_append(missing_components, 'refresh_agent_performance_stats()');
  ELSE
    component_count := component_count + 1;
  END IF;

  -- Verificar función update_property_geometry
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'update_property_geometry'
  ) THEN
    missing_components := array_append(missing_components, 'update_property_geometry()');
  ELSE
    component_count := component_count + 1;
  END IF;

  -- Verificar función update_subscription_updated_at
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'update_subscription_updated_at'
  ) THEN
    missing_components := array_append(missing_components, 'update_subscription_updated_at()');
  ELSE
    component_count := component_count + 1;
  END IF;

  -- Verificar trigger user_subscriptions
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'user_subscriptions' 
    AND t.tgname = 'update_user_subscriptions_updated_at'
  ) THEN
    missing_components := array_append(missing_components, 'trigger: update_user_subscriptions_updated_at');
  ELSE
    component_count := component_count + 1;
  END IF;

  -- Verificar trigger properties
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'properties' 
    AND t.tgname = 'update_property_geom'
  ) THEN
    missing_components := array_append(missing_components, 'trigger: update_property_geom');
  ELSE
    component_count := component_count + 1;
  END IF;

  -- Reportar resultados
  IF array_length(missing_components, 1) > 0 THEN
    RAISE WARNING '⚠️ COMPONENTES FALTANTES (%): %', 
      array_length(missing_components, 1), 
      array_to_string(missing_components, ', ');
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '╔══════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║  ✅ PATCH FINAL APLICADO EXITOSAMENTE                    ║';
    RAISE NOTICE '║  📊 % de 8 componentes instalados correctamente          ║', component_count;
    RAISE NOTICE '╚══════════════════════════════════════════════════════════╝';
    RAISE NOTICE '';
    
    -- Tests rápidos
    RAISE NOTICE '📊 Test get_avg_review_time_minutes(): % minutos', public.get_avg_review_time_minutes();
    
    PERFORM * FROM public.get_moderation_stats();
    RAISE NOTICE '📊 Test get_moderation_stats(): ✓ Funcionando';
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 Base de datos Kentra configurada al 100%%';
  END IF;
END;
$$;

-- ============================================
-- NOTAS DE USO
-- ============================================
-- 
-- Para ejecutar:
-- 1. Ir a Supabase Dashboard → SQL Editor
-- 2. Copiar y pegar todo el contenido
-- 3. Ejecutar (Run)
-- 4. Verificar el mensaje de éxito
--
-- Tests manuales:
-- SELECT * FROM pg_extension WHERE extname = 'pg_trgm';
-- SELECT get_avg_review_time_minutes();
-- SELECT * FROM get_moderation_stats();
-- SELECT tgname FROM pg_trigger WHERE tgname LIKE 'update_%';
--
-- ============================================
