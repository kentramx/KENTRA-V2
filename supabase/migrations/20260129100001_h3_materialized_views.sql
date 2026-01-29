-- =============================================
-- ENHANCED GEOHASH MATERIALIZED VIEWS
-- Note: H3 extension not available, using geohash-based clustering
-- These supplement the existing cluster views from 20260126
-- =============================================

-- The existing materialized views from 20260126100000_cluster_materialized_views.sql
-- already provide geohash-based clustering. This migration adds additional
-- precision levels (geohash_7, geohash_8) for finer granularity.

-- =============================================
-- MATERIALIZED VIEW: GEOHASH CLUSTERS AT PRECISION 7 (~153m)
-- For zoom levels 13-14
-- =============================================
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_geohash_clusters_7 AS
SELECT
  geohash_7 as geohash,
  listing_type,
  COUNT(*) as count,
  ROUND(AVG(price)::numeric, 2) as avg_price,
  MIN(price) as min_price,
  MAX(price) as max_price,
  AVG(lat)::double precision as lat,
  AVG(lng)::double precision as lng
FROM properties
WHERE status = 'activa' AND geohash_7 IS NOT NULL
GROUP BY geohash_7, listing_type;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_geohash_clusters_7_pk
  ON mv_geohash_clusters_7(geohash, listing_type);
CREATE INDEX IF NOT EXISTS idx_mv_geohash_clusters_7_location
  ON mv_geohash_clusters_7(lat, lng);

-- =============================================
-- MATERIALIZED VIEW: GEOHASH CLUSTERS AT PRECISION 7 (ALL)
-- =============================================
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_geohash_clusters_7_all AS
SELECT
  geohash_7 as geohash,
  COUNT(*) as count,
  ROUND(AVG(price)::numeric, 2) as avg_price,
  MIN(price) as min_price,
  MAX(price) as max_price,
  AVG(lat)::double precision as lat,
  AVG(lng)::double precision as lng
FROM properties
WHERE status = 'activa' AND geohash_7 IS NOT NULL
GROUP BY geohash_7;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_geohash_clusters_7_all_pk
  ON mv_geohash_clusters_7_all(geohash);
CREATE INDEX IF NOT EXISTS idx_mv_geohash_clusters_7_all_location
  ON mv_geohash_clusters_7_all(lat, lng);

-- =============================================
-- REFRESH FUNCTION FOR NEW VIEWS
-- =============================================
CREATE OR REPLACE FUNCTION refresh_geohash_clusters_extended()
RETURNS void AS $$
BEGIN
  -- Refresh the extended precision views
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_geohash_clusters_7;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_geohash_clusters_7_all;
  RAISE NOTICE 'Extended geohash cluster views refreshed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- GRANT PERMISSIONS
-- =============================================
GRANT SELECT ON mv_geohash_clusters_7 TO anon, authenticated;
GRANT SELECT ON mv_geohash_clusters_7_all TO anon, authenticated;

-- =============================================
-- COMMENTS
-- =============================================
COMMENT ON MATERIALIZED VIEW mv_geohash_clusters_7 IS 'Pre-aggregated clusters at geohash precision 7 (~153m) by listing type';
COMMENT ON MATERIALIZED VIEW mv_geohash_clusters_7_all IS 'Pre-aggregated clusters at geohash precision 7 (~153m) for all listings';
