-- ============================================================================
-- FUNCIONES DE REFRESH PARA MATERIALIZED VIEWS
-- ============================================================================

-- Crear tabla de settings si no existe (primero para evitar errores)
CREATE TABLE IF NOT EXISTS system_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz DEFAULT now()
);

-- Insertar setting inicial
INSERT INTO system_settings (key, value)
VALUES ('last_mv_refresh', NOW()::text)
ON CONFLICT (key) DO NOTHING;

-- Función segura para refrescar materialized views
CREATE OR REPLACE FUNCTION refresh_materialized_views_safe()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Refrescar vistas de conteo
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_property_counts_by_status;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW mv_property_counts_by_status;
  END;

  -- Refrescar vistas de stats globales
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_global_stats;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW mv_global_stats;
  END;

  -- Actualizar timestamp de último refresh
  INSERT INTO system_settings (key, value, updated_at)
  VALUES ('last_mv_refresh', NOW()::text, NOW())
  ON CONFLICT (key) DO UPDATE SET value = NOW()::text, updated_at = NOW();

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error refreshing MVs: %', SQLERRM;
END;
$$;

-- Función para obtener stats de clusters
CREATE OR REPLACE FUNCTION get_cluster_stats()
RETURNS TABLE(
  zoom_level integer,
  cluster_count bigint,
  total_properties bigint,
  avg_cluster_size numeric,
  last_updated timestamptz
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    pc.zoom_level,
    COUNT(*) as cluster_count,
    SUM(pc.property_count) as total_properties,
    AVG(pc.property_count)::numeric(10,2) as avg_cluster_size,
    MAX(pc.updated_at) as last_updated
  FROM property_clusters pc
  GROUP BY pc.zoom_level
  ORDER BY pc.zoom_level;
$$;

-- Comentarios
COMMENT ON FUNCTION refresh_materialized_views_safe IS 'Refresca todas las MVs de forma segura. Llamar periódicamente.';
COMMENT ON FUNCTION get_cluster_stats IS 'Obtiene estadísticas de clusters por zoom level.';
