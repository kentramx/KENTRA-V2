
-- Primero eliminar la función existente
DROP FUNCTION IF EXISTS public.get_map_data(double precision, double precision, double precision, double precision, integer, text, text, numeric, numeric, integer, integer, text, text);

-- Recrear función con LOWER() para filtros case-insensitive
CREATE OR REPLACE FUNCTION public.get_map_data(
  p_north DOUBLE PRECISION,
  p_south DOUBLE PRECISION,
  p_east DOUBLE PRECISION,
  p_west DOUBLE PRECISION,
  p_zoom INTEGER,
  p_listing_type TEXT DEFAULT NULL,
  p_property_type TEXT DEFAULT NULL,
  p_min_price NUMERIC DEFAULT NULL,
  p_max_price NUMERIC DEFAULT NULL,
  p_bedrooms INTEGER DEFAULT NULL,
  p_bathrooms INTEGER DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_municipality TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
  grid_size DOUBLE PRECISION;
  property_count INTEGER;
  max_individual_properties INTEGER := 500;
BEGIN
  grid_size := CASE
    WHEN p_zoom >= 14 THEN 0.001
    WHEN p_zoom >= 12 THEN 0.005
    WHEN p_zoom >= 10 THEN 0.02
    WHEN p_zoom >= 8 THEN 0.1
    WHEN p_zoom >= 6 THEN 0.5
    ELSE 1.0
  END;

  SELECT COUNT(*) INTO property_count
  FROM properties p
  WHERE p.lat IS NOT NULL
    AND p.lng IS NOT NULL
    AND p.lat BETWEEN p_south AND p_north
    AND p.lng BETWEEN p_west AND p_east
    AND p.status IN ('activa', 'active', 'published', 'approved')
    AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
    AND (p_property_type IS NULL OR p.type::TEXT = p_property_type)
    AND (p_min_price IS NULL OR p.price >= p_min_price)
    AND (p_max_price IS NULL OR p.price <= p_max_price)
    AND (p_bedrooms IS NULL OR p.bedrooms >= p_bedrooms)
    AND (p_bathrooms IS NULL OR p.bathrooms >= p_bathrooms)
    AND (p_state IS NULL OR LOWER(p.state) = LOWER(p_state))
    AND (p_municipality IS NULL OR LOWER(p.municipality) = LOWER(p_municipality));

  IF p_zoom >= 14 OR property_count <= max_individual_properties THEN
    SELECT json_build_object(
      'properties', COALESCE((
        SELECT json_agg(json_build_object(
          'id', p.id,
          'lat', p.lat,
          'lng', p.lng,
          'price', p.price,
          'currency', p.currency,
          'type', p.type,
          'title', p.title,
          'bedrooms', p.bedrooms,
          'bathrooms', p.bathrooms,
          'sqft', p.sqft,
          'listing_type', p.listing_type,
          'address', p.address,
          'state', p.state,
          'municipality', p.municipality
        ))
        FROM (
          SELECT *
          FROM properties p
          WHERE p.lat IS NOT NULL
            AND p.lng IS NOT NULL
            AND p.lat BETWEEN p_south AND p_north
            AND p.lng BETWEEN p_west AND p_east
            AND p.status IN ('activa', 'active', 'published', 'approved')
            AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
            AND (p_property_type IS NULL OR p.type::TEXT = p_property_type)
            AND (p_min_price IS NULL OR p.price >= p_min_price)
            AND (p_max_price IS NULL OR p.price <= p_max_price)
            AND (p_bedrooms IS NULL OR p.bedrooms >= p_bedrooms)
            AND (p_bathrooms IS NULL OR p.bathrooms >= p_bathrooms)
            AND (p_state IS NULL OR LOWER(p.state) = LOWER(p_state))
            AND (p_municipality IS NULL OR LOWER(p.municipality) = LOWER(p_municipality))
          ORDER BY p.created_at DESC
          LIMIT 1000
        ) p
      ), '[]'::json),
      'clusters', '[]'::json,
      'total_count', property_count,
      'is_clustered', false
    ) INTO result;
  ELSE
    SELECT json_build_object(
      'properties', '[]'::json,
      'clusters', COALESCE((
        SELECT json_agg(json_build_object(
          'lat', cluster_lat,
          'lng', cluster_lng,
          'count', cluster_count,
          'expansion_zoom', LEAST(p_zoom + 2, 14)
        ))
        FROM (
          SELECT 
            ROUND(p.lat / grid_size) * grid_size + grid_size / 2 AS cluster_lat,
            ROUND(p.lng / grid_size) * grid_size + grid_size / 2 AS cluster_lng,
            COUNT(*) AS cluster_count
          FROM properties p
          WHERE p.lat IS NOT NULL
            AND p.lng IS NOT NULL
            AND p.lat BETWEEN p_south AND p_north
            AND p.lng BETWEEN p_west AND p_east
            AND p.status IN ('activa', 'active', 'published', 'approved')
            AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
            AND (p_property_type IS NULL OR p.type::TEXT = p_property_type)
            AND (p_min_price IS NULL OR p.price >= p_min_price)
            AND (p_max_price IS NULL OR p.price <= p_max_price)
            AND (p_bedrooms IS NULL OR p.bedrooms >= p_bedrooms)
            AND (p_bathrooms IS NULL OR p.bathrooms >= p_bathrooms)
            AND (p_state IS NULL OR LOWER(p.state) = LOWER(p_state))
            AND (p_municipality IS NULL OR LOWER(p.municipality) = LOWER(p_municipality))
          GROUP BY cluster_lat, cluster_lng
          HAVING COUNT(*) > 0
          ORDER BY cluster_count DESC
          LIMIT 200
        ) clusters
      ), '[]'::json),
      'total_count', property_count,
      'is_clustered', true
    ) INTO result;
  END IF;

  RETURN result;
END;
$$;
