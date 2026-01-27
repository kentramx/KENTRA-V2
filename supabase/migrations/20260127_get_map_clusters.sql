-- =============================================
-- RPC: get_map_clusters
-- Clustering en PostgreSQL (no JS) = counts exactos
-- =============================================

DROP FUNCTION IF EXISTS get_map_clusters;

CREATE OR REPLACE FUNCTION get_map_clusters(
  p_north float,
  p_south float,
  p_east float,
  p_west float,
  p_precision int DEFAULT 5,
  p_listing_type text DEFAULT NULL,
  p_property_type text DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_min_bedrooms int DEFAULT NULL
)
RETURNS TABLE (
  id text,
  count bigint,
  lat float,
  lng float,
  min_price numeric,
  max_price numeric
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
      WHEN 7 THEN geohash_7
      ELSE geohash_5
    END as id,
    COUNT(*)::bigint as count,
    AVG(lat)::float as lat,
    AVG(lng)::float as lng,
    MIN(price) as min_price,
    MAX(price) as max_price
  FROM properties
  WHERE status = 'activa'
    AND lat >= p_south AND lat <= p_north
    AND lng >= p_west AND lng <= p_east
    AND (p_listing_type IS NULL OR listing_type = p_listing_type)
    AND (p_property_type IS NULL OR type::text = p_property_type)
    AND (p_min_price IS NULL OR price >= p_min_price)
    AND (p_max_price IS NULL OR price <= p_max_price)
    AND (p_min_bedrooms IS NULL OR bedrooms >= p_min_bedrooms)
  GROUP BY 1
  HAVING COUNT(*) > 0
  ORDER BY count DESC;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION get_map_clusters TO anon, authenticated, service_role;

COMMENT ON FUNCTION get_map_clusters IS
'Returns clusters grouped by geohash with exact counts.
No JS limit - aggregation happens in PostgreSQL.
total = SUM(count) is guaranteed to equal actual property count.';
