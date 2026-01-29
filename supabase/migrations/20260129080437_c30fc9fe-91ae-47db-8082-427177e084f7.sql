-- Rewrite get_map_clusters to use PostGIS grid instead of geohashes
CREATE OR REPLACE FUNCTION public.get_map_clusters(
  p_north double precision,
  p_south double precision,
  p_east double precision,
  p_west double precision,
  p_precision integer DEFAULT 5,
  p_listing_type text DEFAULT NULL,
  p_property_type text DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_min_bedrooms integer DEFAULT NULL
)
RETURNS TABLE(
  id text,
  count bigint,
  lat double precision,
  lng double precision,
  min_price numeric,
  max_price numeric
)
LANGUAGE sql
STABLE PARALLEL SAFE
AS $$
  WITH grid_size AS (
    SELECT CASE p_precision
      WHEN 3 THEN 2.0
      WHEN 4 THEN 0.5
      WHEN 5 THEN 0.1
      WHEN 6 THEN 0.02
      ELSE 0.1
    END as size
  )
  SELECT
    'cluster_' || FLOOR(p.lng / g.size)::text || '_' || FLOOR(p.lat / g.size)::text as id,
    COUNT(*)::bigint as count,
    AVG(p.lat)::double precision as lat,
    AVG(p.lng)::double precision as lng,
    MIN(p.price) as min_price,
    MAX(p.price) as max_price
  FROM properties p, grid_size g
  WHERE p.status = 'activa'
    AND p.lat IS NOT NULL AND p.lng IS NOT NULL
    AND p.lat >= p_south AND p.lat <= p_north
    AND p.lng >= p_west AND p.lng <= p_east
    AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
    AND (p_property_type IS NULL OR p.type::text = p_property_type)
    AND (p_min_price IS NULL OR p.price >= p_min_price)
    AND (p_max_price IS NULL OR p.price <= p_max_price)
    AND (p_min_bedrooms IS NULL OR p.bedrooms >= p_min_bedrooms)
  GROUP BY FLOOR(p.lng / g.size), FLOOR(p.lat / g.size), g.size
  HAVING COUNT(*) > 0
  ORDER BY count DESC
  LIMIT 200;
$$;