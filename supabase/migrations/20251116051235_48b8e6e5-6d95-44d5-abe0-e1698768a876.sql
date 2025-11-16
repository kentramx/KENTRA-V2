-- Fix ambiguous column references in get_property_clusters function
CREATE OR REPLACE FUNCTION get_property_clusters(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  zoom_level integer,
  p_status text DEFAULT 'activa',
  p_state text DEFAULT NULL,
  p_municipality text DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_listing_type text DEFAULT NULL,
  p_price_min numeric DEFAULT NULL,
  p_price_max numeric DEFAULT NULL,
  p_bedrooms integer DEFAULT NULL,
  p_bathrooms integer DEFAULT NULL
)
RETURNS TABLE(
  cluster_id text,
  lat double precision,
  lng double precision,
  property_count integer,
  avg_price numeric,
  property_ids text[]
) AS $$
DECLARE
  grid_size double precision;
BEGIN
  grid_size := CASE 
    WHEN zoom_level >= 15 THEN 0.001
    WHEN zoom_level >= 13 THEN 0.005
    WHEN zoom_level >= 11 THEN 0.02
    WHEN zoom_level >= 9 THEN 0.1
    ELSE 0.5
  END;

  RETURN QUERY
  WITH filtered_properties AS (
    SELECT 
      p.id,
      ST_X(p.geom) as prop_lng,
      ST_Y(p.geom) as prop_lat,
      p.price
    FROM properties p
    WHERE p.geom && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
      AND p.status::text = p_status
      AND (p_state IS NULL OR p.state = p_state)
      AND (p_municipality IS NULL OR p.municipality = p_municipality)
      AND (p_type IS NULL OR p.type::text = p_type)
      AND (p_listing_type IS NULL OR 
           (p_listing_type = 'venta' AND p.for_sale = true) OR
           (p_listing_type = 'renta' AND p.for_rent = true))
      AND (p_price_min IS NULL OR p.price >= p_price_min)
      AND (p_price_max IS NULL OR p.price <= p_price_max)
      AND (p_bedrooms IS NULL OR p.bedrooms >= p_bedrooms)
      AND (p_bathrooms IS NULL OR p.bathrooms >= p_bathrooms)
  ),
  clusters AS (
    SELECT
      FLOOR(fp.prop_lng / grid_size)::text || '_' || FLOOR(fp.prop_lat / grid_size)::text as cluster_id,
      AVG(fp.prop_lng)::double precision as lng,
      AVG(fp.prop_lat)::double precision as lat,
      COUNT(*)::integer as property_count,
      ROUND(AVG(fp.price), 2) as avg_price,
      array_agg(fp.id::text) as property_ids
    FROM filtered_properties fp
    GROUP BY FLOOR(fp.prop_lng / grid_size), FLOOR(fp.prop_lat / grid_size)
  )
  SELECT 
    c.cluster_id,
    c.lat,
    c.lng,
    c.property_count,
    c.avg_price,
    c.property_ids
  FROM clusters c;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;