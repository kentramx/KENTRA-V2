-- Function to populate geohashes in batches
-- This avoids timeout by processing in chunks

CREATE OR REPLACE FUNCTION populate_geohashes_batch(p_batch_size integer DEFAULT 10000)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '120s'
AS $$
DECLARE
  v_updated integer;
  v_remaining integer;
BEGIN
  -- Update batch using CTE for efficient selection
  WITH to_update AS (
    SELECT id
    FROM properties
    WHERE geom IS NOT NULL
      AND geohash_4 IS NULL
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE properties p
  SET
    geohash_3 = ST_GeoHash(p.geom, 3),
    geohash_4 = ST_GeoHash(p.geom, 4),
    geohash_5 = ST_GeoHash(p.geom, 5),
    geohash_6 = ST_GeoHash(p.geom, 6)
  FROM to_update
  WHERE p.id = to_update.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Count remaining
  SELECT COUNT(*) INTO v_remaining
  FROM properties
  WHERE geom IS NOT NULL AND geohash_4 IS NULL;

  RETURN jsonb_build_object(
    'updated', v_updated,
    'remaining', v_remaining,
    'done', v_remaining = 0
  );
END;
$$;

-- Function to check geohash population status
CREATE OR REPLACE FUNCTION check_geohash_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total integer;
  v_with_geohash integer;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM properties
  WHERE geom IS NOT NULL;

  SELECT COUNT(*) INTO v_with_geohash
  FROM properties
  WHERE geom IS NOT NULL AND geohash_4 IS NOT NULL;

  RETURN jsonb_build_object(
    'total', v_total,
    'with_geohash', v_with_geohash,
    'without_geohash', v_total - v_with_geohash,
    'progress_pct', CASE WHEN v_total > 0 THEN ROUND((v_with_geohash::numeric / v_total) * 100) ELSE 0 END
  );
END;
$$;

-- Create partial indexes for geohash columns (if not exist)
CREATE INDEX IF NOT EXISTS idx_props_geohash_3_active
ON properties(geohash_3)
WHERE status = 'activa' AND geohash_3 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_props_geohash_4_active
ON properties(geohash_4)
WHERE status = 'activa' AND geohash_4 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_props_geohash_5_active
ON properties(geohash_5)
WHERE status = 'activa' AND geohash_5 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_props_geohash_6_active
ON properties(geohash_6)
WHERE status = 'activa' AND geohash_6 IS NOT NULL;

-- Analyze table to update statistics
ANALYZE properties;
