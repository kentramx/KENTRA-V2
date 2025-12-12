-- First drop the existing function, then recreate with correct enum values
DROP FUNCTION IF EXISTS public.get_map_data(double precision, double precision, double precision, double precision, integer, text, text, numeric, numeric, integer, integer, text, text);

CREATE OR REPLACE FUNCTION public.get_map_data(
  p_north double precision,
  p_south double precision,
  p_east double precision,
  p_west double precision,
  p_zoom integer,
  p_listing_type text DEFAULT NULL,
  p_property_type text DEFAULT NULL,
  p_price_min numeric DEFAULT NULL,
  p_price_max numeric DEFAULT NULL,
  p_bedrooms integer DEFAULT NULL,
  p_bathrooms integer DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_municipality text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  grid_size double precision;
  property_count integer;
  max_individual_properties integer := 500;
BEGIN
  grid_size := CASE
    WHEN p_zoom >= 16 THEN 0.001
    WHEN p_zoom >= 14 THEN 0.005
    WHEN p_zoom >= 12 THEN 0.01
    WHEN p_zoom >= 10 THEN 0.05
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
    AND p.status = 'activa'
    AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
    AND (p_property_type IS NULL OR p.type::text = p_property_type)
    AND (p_price_min IS NULL OR p.price >= p_price_min)
    AND (p_price_max IS NULL OR p.price <= p_price_max)
    AND (p_bedrooms IS NULL OR p.bedrooms >= p_bedrooms)
    AND (p_bathrooms IS NULL OR p.bathrooms >= p_bathrooms)
    AND (p_state IS NULL OR p.state ILIKE p_state)
    AND (p_municipality IS NULL OR p.municipality ILIKE p_municipality);

  IF p_zoom >= 14 OR property_count <= max_individual_properties THEN
    SELECT jsonb_build_object(
      'properties', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'title', p.title,
            'price', p.price,
            'currency', p.currency,
            'lat', p.lat,
            'lng', p.lng,
            'type', p.type,
            'listing_type', p.listing_type,
            'bedrooms', p.bedrooms,
            'bathrooms', p.bathrooms,
            'sqft', p.sqft,
            'address', p.address,
            'municipality', p.municipality,
            'state', p.state,
            'main_image', (
              SELECT url FROM images 
              WHERE property_id = p.id 
              ORDER BY position ASC NULLS LAST 
              LIMIT 1
            ),
            'is_featured', EXISTS (
              SELECT 1 FROM featured_properties fp 
              WHERE fp.property_id = p.id 
              AND fp.end_date > NOW() 
              AND fp.status = 'activa'
            )
          )
          ORDER BY 
            EXISTS (
              SELECT 1 FROM featured_properties fp 
              WHERE fp.property_id = p.id 
              AND fp.end_date > NOW() 
              AND fp.status = 'activa'
            ) DESC,
            p.created_at DESC
        )
        FROM properties p
        WHERE p.lat IS NOT NULL
          AND p.lng IS NOT NULL
          AND p.lat BETWEEN p_south AND p_north
          AND p.lng BETWEEN p_west AND p_east
          AND p.status = 'activa'
          AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
          AND (p_property_type IS NULL OR p.type::text = p_property_type)
          AND (p_price_min IS NULL OR p.price >= p_price_min)
          AND (p_price_max IS NULL OR p.price <= p_price_max)
          AND (p_bedrooms IS NULL OR p.bedrooms >= p_bedrooms)
          AND (p_bathrooms IS NULL OR p.bathrooms >= p_bathrooms)
          AND (p_state IS NULL OR p.state ILIKE p_state)
          AND (p_municipality IS NULL OR p.municipality ILIKE p_municipality)
      ), '[]'::jsonb),
      'clusters', '[]'::jsonb,
      'total_count', property_count,
      'is_clustered', false
    ) INTO result;
  ELSE
    SELECT jsonb_build_object(
      'properties', '[]'::jsonb,
      'clusters', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'lat', cluster_lat,
            'lng', cluster_lng,
            'property_count', cnt,
            'expansion_zoom', p_zoom + 2
          )
        )
        FROM (
          SELECT 
            ROUND(p.lat / grid_size) * grid_size + grid_size / 2 as cluster_lat,
            ROUND(p.lng / grid_size) * grid_size + grid_size / 2 as cluster_lng,
            COUNT(*) as cnt
          FROM properties p
          WHERE p.lat IS NOT NULL
            AND p.lng IS NOT NULL
            AND p.lat BETWEEN p_south AND p_north
            AND p.lng BETWEEN p_west AND p_east
            AND p.status = 'activa'
            AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
            AND (p_property_type IS NULL OR p.type::text = p_property_type)
            AND (p_price_min IS NULL OR p.price >= p_price_min)
            AND (p_price_max IS NULL OR p.price <= p_price_max)
            AND (p_bedrooms IS NULL OR p.bedrooms >= p_bedrooms)
            AND (p_bathrooms IS NULL OR p.bathrooms >= p_bathrooms)
            AND (p_state IS NULL OR p.state ILIKE p_state)
            AND (p_municipality IS NULL OR p.municipality ILIKE p_municipality)
          GROUP BY cluster_lat, cluster_lng
        ) clusters
      ), '[]'::jsonb),
      'total_count', property_count,
      'is_clustered', true
    ) INTO result;
  END IF;

  RETURN result;
END;
$$;