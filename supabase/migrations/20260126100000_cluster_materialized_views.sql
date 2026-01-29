-- Enterprise Map Clustering - Materialized Views
-- Created: 2026-01-26
-- Purpose: Pre-aggregated cluster data for instant map responses

-- ============================================================================
-- MATERIALIZED VIEWS
-- ============================================================================

-- GH3 clusters (country level, ~33 unique geohashes)
DROP MATERIALIZED VIEW IF EXISTS mv_property_clusters_gh3 CASCADE;
CREATE MATERIALIZED VIEW mv_property_clusters_gh3 AS
SELECT
  geohash_3 as geohash,
  listing_type,
  COUNT(*) as count,
  AVG(lat)::float as lat,
  AVG(lng)::float as lng,
  MIN(price) as min_price,
  MAX(price) as max_price
FROM properties
WHERE status = 'activa' AND geohash_3 IS NOT NULL
GROUP BY geohash_3, listing_type;

-- GH4 clusters (state/region level, ~666 unique geohashes)
DROP MATERIALIZED VIEW IF EXISTS mv_property_clusters_gh4 CASCADE;
CREATE MATERIALIZED VIEW mv_property_clusters_gh4 AS
SELECT
  geohash_4 as geohash,
  listing_type,
  COUNT(*) as count,
  AVG(lat)::float as lat,
  AVG(lng)::float as lng,
  MIN(price) as min_price,
  MAX(price) as max_price
FROM properties
WHERE status = 'activa' AND geohash_4 IS NOT NULL
GROUP BY geohash_4, listing_type;

-- GH5 clusters (city level, ~19K unique geohashes)
DROP MATERIALIZED VIEW IF EXISTS mv_property_clusters_gh5 CASCADE;
CREATE MATERIALIZED VIEW mv_property_clusters_gh5 AS
SELECT
  geohash_5 as geohash,
  listing_type,
  COUNT(*) as count,
  AVG(lat)::float as lat,
  AVG(lng)::float as lng,
  MIN(price) as min_price,
  MAX(price) as max_price
FROM properties
WHERE status = 'activa' AND geohash_5 IS NOT NULL
GROUP BY geohash_5, listing_type;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- GH3 indexes
CREATE INDEX IF NOT EXISTS idx_mv_gh3_geohash ON mv_property_clusters_gh3(geohash);
CREATE INDEX IF NOT EXISTS idx_mv_gh3_listing ON mv_property_clusters_gh3(listing_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_gh3_unique ON mv_property_clusters_gh3(geohash, listing_type);

-- GH4 indexes
CREATE INDEX IF NOT EXISTS idx_mv_gh4_geohash ON mv_property_clusters_gh4(geohash);
CREATE INDEX IF NOT EXISTS idx_mv_gh4_listing ON mv_property_clusters_gh4(listing_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_gh4_unique ON mv_property_clusters_gh4(geohash, listing_type);

-- GH5 indexes
CREATE INDEX IF NOT EXISTS idx_mv_gh5_geohash ON mv_property_clusters_gh5(geohash);
CREATE INDEX IF NOT EXISTS idx_mv_gh5_listing ON mv_property_clusters_gh5(listing_type);
CREATE INDEX IF NOT EXISTS idx_mv_gh5_lat_lng ON mv_property_clusters_gh5(lat, lng);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_gh5_unique ON mv_property_clusters_gh5(geohash, listing_type);

-- ============================================================================
-- RPC FUNCTIONS
-- ============================================================================

-- Get clusters at GH3 precision (zoom <= 6)
DROP FUNCTION IF EXISTS get_clusters_gh3(float, float, float, float, text, text, numeric, numeric, integer);
CREATE OR REPLACE FUNCTION get_clusters_gh3(
  p_north float,
  p_south float,
  p_east float,
  p_west float,
  p_listing_type text DEFAULT NULL,
  p_property_type text DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_min_bedrooms integer DEFAULT NULL
)
RETURNS TABLE(
  geohash text,
  count bigint,
  lat float,
  lng float,
  min_price numeric,
  max_price numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    geohash,
    SUM(count)::bigint as count,
    AVG(lat)::float as lat,
    AVG(lng)::float as lng,
    MIN(min_price) as min_price,
    MAX(max_price) as max_price
  FROM mv_property_clusters_gh3
  WHERE lat >= p_south AND lat <= p_north
    AND lng >= p_west AND lng <= p_east
    AND (p_listing_type IS NULL OR listing_type = p_listing_type)
  GROUP BY geohash
  ORDER BY count DESC
  LIMIT 200;
$$;

-- Get clusters at GH4 precision (zoom 7-9)
DROP FUNCTION IF EXISTS get_clusters_gh4(float, float, float, float, text, text, numeric, numeric, integer);
CREATE OR REPLACE FUNCTION get_clusters_gh4(
  p_north float,
  p_south float,
  p_east float,
  p_west float,
  p_listing_type text DEFAULT NULL,
  p_property_type text DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_min_bedrooms integer DEFAULT NULL
)
RETURNS TABLE(
  geohash text,
  count bigint,
  lat float,
  lng float,
  min_price numeric,
  max_price numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    geohash,
    SUM(count)::bigint as count,
    AVG(lat)::float as lat,
    AVG(lng)::float as lng,
    MIN(min_price) as min_price,
    MAX(max_price) as max_price
  FROM mv_property_clusters_gh4
  WHERE lat >= p_south AND lat <= p_north
    AND lng >= p_west AND lng <= p_east
    AND (p_listing_type IS NULL OR listing_type = p_listing_type)
  GROUP BY geohash
  ORDER BY count DESC
  LIMIT 500;
$$;

-- Get clusters at GH5 precision (zoom 10-12)
DROP FUNCTION IF EXISTS get_clusters_gh5(float, float, float, float, text, text, numeric, numeric, integer);
CREATE OR REPLACE FUNCTION get_clusters_gh5(
  p_north float,
  p_south float,
  p_east float,
  p_west float,
  p_listing_type text DEFAULT NULL,
  p_property_type text DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_min_bedrooms integer DEFAULT NULL
)
RETURNS TABLE(
  geohash text,
  count bigint,
  lat float,
  lng float,
  min_price numeric,
  max_price numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    geohash,
    SUM(count)::bigint as count,
    AVG(lat)::float as lat,
    AVG(lng)::float as lng,
    MIN(min_price) as min_price,
    MAX(max_price) as max_price
  FROM mv_property_clusters_gh5
  WHERE lat >= p_south AND lat <= p_north
    AND lng >= p_west AND lng <= p_east
    AND (p_listing_type IS NULL OR listing_type = p_listing_type)
  GROUP BY geohash
  ORDER BY count DESC
  LIMIT 500;
$$;

-- ============================================================================
-- REFRESH FUNCTION
-- ============================================================================

-- Call this periodically (e.g., every hour) or after bulk property updates
CREATE OR REPLACE FUNCTION refresh_cluster_views()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- CONCURRENTLY allows reads during refresh (requires unique index)
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_property_clusters_gh3;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_property_clusters_gh4;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_property_clusters_gh5;
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION refresh_cluster_views() TO service_role;
