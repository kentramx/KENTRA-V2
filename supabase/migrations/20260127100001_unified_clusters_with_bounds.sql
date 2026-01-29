-- Unified Clusters with Real Bounds
-- Created: 2026-01-27
-- Purpose: Single source of truth for map clustering with real property bounds

-- Drop existing function if exists
DROP FUNCTION IF EXISTS get_clusters_with_bounds(float, float, float, float, text, text, numeric, numeric, integer, integer);

-- Create new function that returns clusters with REAL bounds
CREATE OR REPLACE FUNCTION get_clusters_with_bounds(
  p_north float,
  p_south float,
  p_east float,
  p_west float,
  p_listing_type text DEFAULT NULL,
  p_property_type text DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_min_bedrooms integer DEFAULT NULL,
  p_precision integer DEFAULT 5
)
RETURNS TABLE(
  id text,
  lat float,
  lng float,
  count bigint,
  min_price numeric,
  max_price numeric,
  bounds_north float,
  bounds_south float,
  bounds_east float,
  bounds_west float
)
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT
    CASE p_precision
      WHEN 3 THEN geohash_3
      WHEN 4 THEN geohash_4
      WHEN 5 THEN geohash_5
      WHEN 6 THEN geohash_6
      ELSE geohash_5
    END as id,
    AVG(lat)::float as lat,
    AVG(lng)::float as lng,
    COUNT(*)::bigint as count,
    MIN(price) as min_price,
    MAX(price) as max_price,
    MAX(lat)::float as bounds_north,
    MIN(lat)::float as bounds_south,
    MAX(lng)::float as bounds_east,
    MIN(lng)::float as bounds_west
  FROM properties
  WHERE status = 'activa'
    AND lat >= p_south AND lat <= p_north
    AND lng >= p_west AND lng <= p_east
    AND (p_listing_type IS NULL OR listing_type = p_listing_type)
    AND (p_property_type IS NULL OR type::text = p_property_type)
    AND (p_min_price IS NULL OR price >= p_min_price)
    AND (p_max_price IS NULL OR price <= p_max_price)
    AND (p_min_bedrooms IS NULL OR bedrooms >= p_min_bedrooms)
  GROUP BY
    CASE p_precision
      WHEN 3 THEN geohash_3
      WHEN 4 THEN geohash_4
      WHEN 5 THEN geohash_5
      WHEN 6 THEN geohash_6
      ELSE geohash_5
    END
  HAVING COUNT(*) > 0
  ORDER BY count DESC
  LIMIT 500;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_clusters_with_bounds TO anon, authenticated, service_role;

-- Add comment
COMMENT ON FUNCTION get_clusters_with_bounds IS 'Returns clusters with real property bounds for accurate fitBounds on click. Applies all filters dynamically.';
