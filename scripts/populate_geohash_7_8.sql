-- =============================================================================
-- Script to populate geohash_7 and geohash_8 columns
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
--
-- INSTRUCTIONS:
-- 1. Copy and paste this entire script into the SQL Editor
-- 2. Click "Run" - it will process up to 50,000 rows at a time
-- 3. Repeat until you see "0 rows updated" in all batches
-- 4. Then run the REFRESH MATERIALIZED VIEW commands at the bottom
-- =============================================================================

-- Process 50,000 rows in batches of 500 (100 iterations)
DO $$
DECLARE
  rows_updated INTEGER := 1;
  batch_count INTEGER := 0;
  batch_size INTEGER := 500;
  total_updated INTEGER := 0;
BEGIN
  WHILE rows_updated > 0 AND batch_count < 100 LOOP
    WITH updated AS (
      UPDATE properties p
      SET
        geohash_7 = ST_GeoHash(ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326), 7),
        geohash_8 = ST_GeoHash(ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326), 8)
      FROM (
        SELECT id FROM properties
        WHERE lat IS NOT NULL
          AND lng IS NOT NULL
          AND geohash_7 IS NULL
        LIMIT batch_size
      ) batch
      WHERE p.id = batch.id
      RETURNING p.id
    )
    SELECT COUNT(*) INTO rows_updated FROM updated;

    batch_count := batch_count + 1;
    total_updated := total_updated + rows_updated;

    -- Small pause between batches
    PERFORM pg_sleep(0.05);
  END LOOP;

  RAISE NOTICE 'Total batches: %, Total rows updated: %', batch_count, total_updated;
END $$;

-- Check progress
SELECT
  'Progress' as status,
  COUNT(*) FILTER (WHERE geohash_7 IS NOT NULL) as with_geohash,
  COUNT(*) FILTER (WHERE geohash_7 IS NULL AND lat IS NOT NULL) as pending,
  COUNT(*) as total
FROM properties
WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- =============================================================================
-- AFTER ALL ROWS ARE POPULATED, run these commands to refresh the views:
-- =============================================================================

-- REFRESH MATERIALIZED VIEW mv_geohash_clusters_7;
-- REFRESH MATERIALIZED VIEW mv_geohash_clusters_7_all;

-- Verify final counts
-- SELECT
--   'Final Status' as status,
--   COUNT(*) FILTER (WHERE geohash_7 IS NOT NULL) as with_geohash_7,
--   COUNT(*) as total
-- FROM properties
-- WHERE lat IS NOT NULL AND lng IS NOT NULL;
