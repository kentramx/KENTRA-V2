-- Ultra-optimized populate function with minimal overhead
-- Uses UPDATE ... RETURNING to avoid separate COUNT queries

DROP FUNCTION IF EXISTS populate_geohash_batch(integer);

CREATE OR REPLACE FUNCTION populate_geohash_batch(batch_size integer DEFAULT 500)
RETURNS TABLE(rows_updated integer, remaining integer) AS $$
DECLARE
  updated_count integer;
BEGIN
  -- Direct UPDATE with LIMIT, no subquery
  WITH updated AS (
    UPDATE properties p
    SET
      geohash_7 = ST_GeoHash(ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326), 7),
      geohash_8 = ST_GeoHash(ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326), 8)
    FROM (
      SELECT id
      FROM properties
      WHERE lat IS NOT NULL
        AND lng IS NOT NULL
        AND geohash_7 IS NULL
      LIMIT batch_size
      FOR UPDATE SKIP LOCKED
    ) batch
    WHERE p.id = batch.id
    RETURNING p.id
  )
  SELECT COUNT(*)::integer INTO updated_count FROM updated;

  -- Return -1 for remaining to skip expensive count
  -- The caller can check if rows_updated < batch_size to know we're done
  RETURN QUERY SELECT updated_count, -1;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION populate_geohash_batch TO service_role;
