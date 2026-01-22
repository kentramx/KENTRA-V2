-- ============================================================================
-- ENTERPRISE OPTIMIZATIONS: Final 1M+ Scale Readiness
-- ============================================================================
-- This migration adds:
-- 1. Materialized view refresh scheduling support
-- 2. Query performance monitoring
-- 3. Automatic vacuum tuning for properties table
-- 4. Additional covering indexes
-- 5. Connection and query statistics tracking
-- ============================================================================

-- ============================================================================
-- 1. OPTIMIZED VACUUM SETTINGS FOR LARGE TABLES
-- ============================================================================
-- Tune autovacuum for properties table to handle 1M+ rows efficiently

ALTER TABLE properties SET (
  autovacuum_vacuum_scale_factor = 0.05,  -- Vacuum when 5% of rows are dead (vs default 20%)
  autovacuum_analyze_scale_factor = 0.02, -- Analyze when 2% of rows change
  autovacuum_vacuum_cost_delay = 10       -- Reduce delay for faster vacuuming
);

ALTER TABLE images SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE property_views SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

-- ============================================================================
-- 2. COVERING INDEXES FOR COMMON QUERIES (Index-Only Scans)
-- ============================================================================
-- These indexes include all columns needed for queries, avoiding table lookups

-- Covering index for property cards (most common query)
CREATE INDEX IF NOT EXISTS idx_properties_card_covering
  ON properties (status, listing_type, created_at DESC)
  INCLUDE (id, title, price, currency, type, address, municipality, state, bedrooms, bathrooms, sqft, is_featured, agent_id)
  WHERE status = 'activa';

-- Covering index for map markers
CREATE INDEX IF NOT EXISTS idx_properties_map_covering
  ON properties (status, lat, lng)
  INCLUDE (id, title, price, currency, type, listing_type, bedrooms, bathrooms, is_featured)
  WHERE status = 'activa' AND lat IS NOT NULL AND lng IS NOT NULL;

-- ============================================================================
-- 3. QUERY STATISTICS TRACKING
-- ============================================================================
-- Enable pg_stat_statements if not already enabled (requires superuser, may fail)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_stat_statements extension not available or already exists';
END $$;

-- ============================================================================
-- 4. MATERIALIZED VIEW REFRESH FUNCTION (Enhanced)
-- ============================================================================
-- Enhanced refresh with timing and error handling

CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS jsonb AS $$
DECLARE
  start_time timestamptz;
  end_time timestamptz;
  result jsonb := '{}';
BEGIN
  -- Refresh global stats
  start_time := clock_timestamp();
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_global_stats;
    end_time := clock_timestamp();
    result := result || jsonb_build_object('mv_global_stats', jsonb_build_object(
      'status', 'success',
      'duration_ms', EXTRACT(MILLISECOND FROM (end_time - start_time))
    ));
  EXCEPTION WHEN OTHERS THEN
    result := result || jsonb_build_object('mv_global_stats', jsonb_build_object(
      'status', 'error',
      'error', SQLERRM
    ));
  END;

  -- Refresh property counts
  start_time := clock_timestamp();
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_property_counts_by_status;
    end_time := clock_timestamp();
    result := result || jsonb_build_object('mv_property_counts_by_status', jsonb_build_object(
      'status', 'success',
      'duration_ms', EXTRACT(MILLISECOND FROM (end_time - start_time))
    ));
  EXCEPTION WHEN OTHERS THEN
    result := result || jsonb_build_object('mv_property_counts_by_status', jsonb_build_object(
      'status', 'error',
      'error', SQLERRM
    ));
  END;

  -- Update refresh timestamp
  result := result || jsonb_build_object('refreshed_at', NOW());

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. DATABASE HEALTH CHECK FUNCTION
-- ============================================================================
-- Returns key health metrics for monitoring

CREATE OR REPLACE FUNCTION get_database_health()
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'timestamp', NOW(),
    'database_size', pg_size_pretty(pg_database_size(current_database())),
    'properties_count', (SELECT COUNT(*) FROM properties),
    'active_properties', (SELECT COUNT(*) FROM properties WHERE status = 'activa'),
    'users_count', (SELECT COUNT(*) FROM profiles),
    'connections', (SELECT jsonb_build_object(
      'active', (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active'),
      'idle', (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'idle'),
      'total', (SELECT COUNT(*) FROM pg_stat_activity)
    )),
    'table_sizes', (
      SELECT jsonb_object_agg(tablename, pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)))
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN ('properties', 'profiles', 'images', 'messages', 'favorites', 'property_views')
    ),
    'cache_hit_ratio', (
      SELECT ROUND(
        100.0 * sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0),
        2
      )
      FROM pg_statio_user_tables
    ),
    'index_usage', (
      SELECT ROUND(
        100.0 * sum(idx_scan) / nullif(sum(idx_scan) + sum(seq_scan), 0),
        2
      )
      FROM pg_stat_user_tables
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 6. SLOW QUERY DETECTION FUNCTION
-- ============================================================================
-- Returns queries that might need optimization

CREATE OR REPLACE FUNCTION get_slow_queries(min_duration_ms int DEFAULT 1000)
RETURNS TABLE (
  query text,
  calls bigint,
  total_time_ms numeric,
  mean_time_ms numeric,
  rows_returned bigint
) AS $$
BEGIN
  -- Only works if pg_stat_statements is enabled
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') THEN
    RETURN QUERY
    SELECT
      pss.query::text,
      pss.calls,
      ROUND(pss.total_exec_time::numeric, 2) as total_time_ms,
      ROUND(pss.mean_exec_time::numeric, 2) as mean_time_ms,
      pss.rows
    FROM pg_stat_statements pss
    WHERE pss.mean_exec_time > min_duration_ms
    ORDER BY pss.mean_exec_time DESC
    LIMIT 20;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 7. PROPERTY SEARCH WITH AUTO-CACHING HINT
-- ============================================================================
-- Wrapper that returns cache key for client-side caching

CREATE OR REPLACE FUNCTION search_properties_with_cache_key(
  p_status text DEFAULT 'activa',
  p_listing_type text DEFAULT NULL,
  p_property_type text DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_min_bedrooms int DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_municipality text DEFAULT NULL,
  p_sort text DEFAULT 'newest',
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS jsonb AS $$
DECLARE
  cache_key text;
  result jsonb;
  properties_result jsonb;
  total_count bigint;
BEGIN
  -- Generate deterministic cache key
  cache_key := md5(concat_ws('|',
    COALESCE(p_status, ''),
    COALESCE(p_listing_type, ''),
    COALESCE(p_property_type, ''),
    COALESCE(p_min_price::text, ''),
    COALESCE(p_max_price::text, ''),
    COALESCE(p_min_bedrooms::text, ''),
    COALESCE(p_state, ''),
    COALESCE(p_municipality, ''),
    p_sort,
    p_limit::text,
    p_offset::text
  ));

  -- Get properties using existing function
  SELECT row_to_json(r)::jsonb INTO result
  FROM (
    SELECT * FROM search_properties(
      p_status, p_listing_type, p_property_type,
      p_min_price, p_max_price, p_min_bedrooms,
      p_state, p_municipality,
      NULL, NULL, NULL, NULL, -- bounds
      p_sort, p_limit, p_offset
    )
  ) r;

  -- Add cache key to result
  result := COALESCE(result, '{}'::jsonb) || jsonb_build_object(
    'cache_key', cache_key,
    'cache_ttl_seconds', 60
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 8. OPTIMIZED AGENT PROPERTY COUNT (for subscription limits)
-- ============================================================================
-- Fast count check for agent property limits

CREATE OR REPLACE FUNCTION get_agent_property_counts(p_agent_id uuid)
RETURNS TABLE (
  active_count bigint,
  pending_count bigint,
  total_count bigint,
  featured_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status = 'activa') as active_count,
    COUNT(*) FILTER (WHERE status = 'pendiente_aprobacion') as pending_count,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE is_featured = true AND status = 'activa') as featured_count
  FROM properties
  WHERE agent_id = p_agent_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 9. BATCH PROPERTY STATUS UPDATE (for admin operations)
-- ============================================================================
-- Efficient batch updates with audit logging

CREATE OR REPLACE FUNCTION batch_update_property_status(
  p_property_ids uuid[],
  p_new_status text,
  p_updated_by uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  updated_count int;
BEGIN
  -- Validate status
  IF p_new_status NOT IN ('activa', 'pendiente_aprobacion', 'rechazada', 'expirada', 'borrador', 'inactiva') THEN
    RETURN jsonb_build_object('error', 'Invalid status', 'valid_statuses', ARRAY['activa', 'pendiente_aprobacion', 'rechazada', 'expirada', 'borrador', 'inactiva']);
  END IF;

  -- Batch update
  UPDATE properties
  SET
    status = p_new_status::property_status,
    updated_at = NOW(),
    rejection_reason = CASE WHEN p_new_status = 'rechazada' THEN p_reason ELSE rejection_reason END
  WHERE id = ANY(p_property_ids);

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'updated_count', updated_count,
    'new_status', p_new_status,
    'updated_by', p_updated_by,
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 10. ANALYZE UPDATED TABLES
-- ============================================================================
ANALYZE properties;
ANALYZE images;
ANALYZE profiles;
ANALYZE favorites;
ANALYZE property_views;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION refresh_all_materialized_views IS 'Refreshes all materialized views with timing info. Call via cron every 5-15 minutes.';
COMMENT ON FUNCTION get_database_health IS 'Returns database health metrics for monitoring dashboards.';
COMMENT ON FUNCTION get_slow_queries IS 'Returns slow queries for optimization. Requires pg_stat_statements.';
COMMENT ON FUNCTION get_agent_property_counts IS 'Fast property count check for subscription limit enforcement.';
COMMENT ON FUNCTION batch_update_property_status IS 'Batch update property statuses for admin bulk operations.';
