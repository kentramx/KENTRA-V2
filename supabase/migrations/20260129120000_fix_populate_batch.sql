-- Fix the populate function with smaller batches and no timeout issues

DROP FUNCTION IF EXISTS populate_geohash_batch(integer);

CREATE OR REPLACE FUNCTION populate_geohash_batch(batch_size integer DEFAULT 1000)
RETURNS TABLE(rows_updated integer, remaining integer) AS $$
DECLARE
  updated_count integer;
  pending_count integer;
BEGIN
  -- Update a small batch
  UPDATE properties
  SET
    geohash_7 = ST_GeoHash(ST_SetSRID(ST_MakePoint(lng, lat), 4326), 7),
    geohash_8 = ST_GeoHash(ST_SetSRID(ST_MakePoint(lng, lat), 4326), 8)
  WHERE id IN (
    SELECT id
    FROM properties
    WHERE lat IS NOT NULL
      AND lng IS NOT NULL
      AND geohash_7 IS NULL
    LIMIT batch_size
  );

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  -- Count remaining (estimate for performance)
  SELECT COUNT(*)::integer INTO pending_count
  FROM properties
  WHERE lat IS NOT NULL
    AND lng IS NOT NULL
    AND geohash_7 IS NULL
  LIMIT 100000;

  RETURN QUERY SELECT updated_count, pending_count;
END;
$$ LANGUAGE plpgsql;

-- Also check current state
DO $$
DECLARE
  total_props integer;
  with_geohash7 integer;
BEGIN
  SELECT COUNT(*) INTO total_props FROM properties WHERE lat IS NOT NULL;
  SELECT COUNT(*) INTO with_geohash7 FROM properties WHERE geohash_7 IS NOT NULL;
  RAISE NOTICE 'Total properties with coords: %, with geohash_7: %', total_props, with_geohash7;
END $$;
