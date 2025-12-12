-- Primero eliminar la función existente
DROP FUNCTION IF EXISTS get_map_data(double precision,double precision,double precision,double precision,integer,text,text,numeric,numeric,integer,integer,text,text);

-- Crear función auxiliar para normalizar nombres de estados
CREATE OR REPLACE FUNCTION normalize_state_name(input_state text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF input_state IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Normalizar variantes de Ciudad de México
  IF unaccent(LOWER(input_state)) IN ('mexico city', 'cdmx', 'ciudad de mexico', 'df', 'distrito federal') THEN
    RETURN 'Ciudad de México';
  END IF;
  
  -- Normalizar variantes de Estado de México
  IF unaccent(LOWER(input_state)) IN ('state of mexico', 'estado de mexico', 'edomex') THEN
    RETURN 'Estado de México';
  END IF;
  
  -- Normalizar variantes de Nuevo León
  IF unaccent(LOWER(input_state)) IN ('nuevo leon', 'nl') THEN
    RETURN 'Nuevo León';
  END IF;
  
  -- Normalizar variantes de Querétaro
  IF unaccent(LOWER(input_state)) IN ('queretaro') THEN
    RETURN 'Querétaro';
  END IF;
  
  -- Normalizar variantes de Yucatán
  IF unaccent(LOWER(input_state)) IN ('yucatan') THEN
    RETURN 'Yucatán';
  END IF;
  
  -- Normalizar variantes de Michoacán
  IF unaccent(LOWER(input_state)) IN ('michoacan') THEN
    RETURN 'Michoacán';
  END IF;
  
  -- Normalizar variantes de San Luis Potosí
  IF unaccent(LOWER(input_state)) IN ('san luis potosi', 'slp') THEN
    RETURN 'San Luis Potosí';
  END IF;
  
  RETURN input_state;
END;
$$;

-- Recrear get_map_data con normalización de estados
CREATE OR REPLACE FUNCTION get_map_data(
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
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  property_count integer;
  grid_size double precision;
  max_individual_properties integer := 200;
  normalized_state text;
BEGIN
  -- Normalizar el nombre del estado
  normalized_state := normalize_state_name(p_state);

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
    AND p.status = 'activa'
    AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
    AND (p_property_type IS NULL OR p.type::TEXT = p_property_type)
    AND (p_price_min IS NULL OR p.price >= p_price_min)
    AND (p_price_max IS NULL OR p.price <= p_price_max)
    AND (p_bedrooms IS NULL OR p.bedrooms >= p_bedrooms)
    AND (p_bathrooms IS NULL OR p.bathrooms >= p_bathrooms)
    AND (normalized_state IS NULL OR unaccent(LOWER(p.state)) = unaccent(LOWER(normalized_state)))
    AND (p_municipality IS NULL OR unaccent(LOWER(p.municipality)) LIKE '%' || unaccent(LOWER(p_municipality)) || '%');

  IF p_zoom >= 14 OR property_count <= max_individual_properties THEN
    SELECT json_build_object(
      'properties', COALESCE((
        SELECT json_agg(json_build_object(
          'id', p.id,
          'lat', p.lat,
          'lng', p.lng,
          'price', p.price,
          'currency', COALESCE(p.currency, 'MXN'),
          'type', p.type,
          'title', p.title,
          'bedrooms', p.bedrooms,
          'bathrooms', p.bathrooms,
          'sqft', p.sqft,
          'listing_type', p.listing_type,
          'address', p.address,
          'state', p.state,
          'municipality', p.municipality,
          'colonia', p.colonia,
          'parking', p.parking,
          'for_sale', COALESCE(p.for_sale, true),
          'for_rent', COALESCE(p.for_rent, false),
          'sale_price', p.sale_price,
          'rent_price', p.rent_price,
          'images', COALESCE((
            SELECT json_agg(json_build_object('url', i.url) ORDER BY i.position)
            FROM images i WHERE i.property_id = p.id
          ), '[]'::json),
          'agent_id', p.agent_id,
          'is_featured', COALESCE((
            SELECT EXISTS(
              SELECT 1 FROM featured_properties fp 
              WHERE fp.property_id = p.id 
              AND fp.status = 'active' 
              AND fp.end_date > now()
            )
          ), false),
          'created_at', p.created_at
        ))
        FROM (
          SELECT * FROM properties p
          WHERE p.lat IS NOT NULL AND p.lng IS NOT NULL
            AND p.lat BETWEEN p_south AND p_north
            AND p.lng BETWEEN p_west AND p_east
            AND p.status = 'activa'
            AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
            AND (p_property_type IS NULL OR p.type::TEXT = p_property_type)
            AND (p_price_min IS NULL OR p.price >= p_price_min)
            AND (p_price_max IS NULL OR p.price <= p_price_max)
            AND (p_bedrooms IS NULL OR p.bedrooms >= p_bedrooms)
            AND (p_bathrooms IS NULL OR p.bathrooms >= p_bathrooms)
            AND (normalized_state IS NULL OR unaccent(LOWER(p.state)) = unaccent(LOWER(normalized_state)))
            AND (p_municipality IS NULL OR unaccent(LOWER(p.municipality)) LIKE '%' || unaccent(LOWER(p_municipality)) || '%')
          ORDER BY (
            SELECT EXISTS(
              SELECT 1 FROM featured_properties fp 
              WHERE fp.property_id = p.id 
              AND fp.status = 'active' 
              AND fp.end_date > now()
            )
          ) DESC, p.created_at DESC
          LIMIT 500
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
          'property_count', cluster_count,
          'expansion_zoom', LEAST(p_zoom + 2, 14)
        ))
        FROM (
          SELECT 
            ROUND(p.lat / grid_size) * grid_size + grid_size / 2 AS cluster_lat,
            ROUND(p.lng / grid_size) * grid_size + grid_size / 2 AS cluster_lng,
            COUNT(*) AS cluster_count
          FROM properties p
          WHERE p.lat IS NOT NULL AND p.lng IS NOT NULL
            AND p.lat BETWEEN p_south AND p_north
            AND p.lng BETWEEN p_west AND p_east
            AND p.status = 'activa'
            AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
            AND (p_property_type IS NULL OR p.type::TEXT = p_property_type)
            AND (p_price_min IS NULL OR p.price >= p_price_min)
            AND (p_price_max IS NULL OR p.price <= p_price_max)
            AND (p_bedrooms IS NULL OR p.bedrooms >= p_bedrooms)
            AND (p_bathrooms IS NULL OR p.bathrooms >= p_bathrooms)
            AND (normalized_state IS NULL OR unaccent(LOWER(p.state)) = unaccent(LOWER(normalized_state)))
            AND (p_municipality IS NULL OR unaccent(LOWER(p.municipality)) LIKE '%' || unaccent(LOWER(p_municipality)) || '%')
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