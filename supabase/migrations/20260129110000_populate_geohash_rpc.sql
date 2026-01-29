-- RPC function to populate geohash_7 and geohash_8 in batches
-- This can be called from an edge function or directly

CREATE OR REPLACE FUNCTION populate_geohash_batch(batch_size integer DEFAULT 5000)
RETURNS TABLE(rows_updated integer, remaining integer) AS $$
DECLARE
  updated_count integer;
  pending_count integer;
BEGIN
  -- Update a batch
  WITH to_update AS (
    SELECT id
    FROM properties
    WHERE lat IS NOT NULL
      AND lng IS NOT NULL
      AND geohash_7 IS NULL
    LIMIT batch_size
  )
  UPDATE properties p
  SET
    geohash_7 = ST_GeoHash(ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326), 7),
    geohash_8 = ST_GeoHash(ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326), 8)
  FROM to_update
  WHERE p.id = to_update.id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  -- Count remaining
  SELECT COUNT(*)::integer INTO pending_count
  FROM properties
  WHERE lat IS NOT NULL
    AND lng IS NOT NULL
    AND geohash_7 IS NULL;

  RETURN QUERY SELECT updated_count, pending_count;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh a materialized view by name
CREATE OR REPLACE FUNCTION refresh_mv(view_name text)
RETURNS void AS $$
BEGIN
  EXECUTE format('REFRESH MATERIALIZED VIEW %I', view_name);
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION populate_geohash_batch TO service_role;
GRANT EXECUTE ON FUNCTION refresh_mv TO service_role;
