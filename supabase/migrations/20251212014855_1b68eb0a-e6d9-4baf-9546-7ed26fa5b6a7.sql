
-- Primero eliminar la función existente
DROP FUNCTION IF EXISTS public.get_map_data(double precision, double precision, double precision, double precision, integer, text, text, numeric, numeric, integer, integer, text, text);

-- Recrear con la lógica mejorada que SIEMPRE devuelve propiedades para la lista
CREATE OR REPLACE FUNCTION public.get_map_data(
  p_north double precision,
  p_south double precision,
  p_east double precision,
  p_west double precision,
  p_zoom integer,
  p_listing_type text DEFAULT NULL,
  p_property_type text DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_min_bedrooms integer DEFAULT NULL,
  p_min_bathrooms integer DEFAULT NULL,
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
  total_count integer;
  grid_size double precision;
  is_clustered boolean;
  normalized_state text;
BEGIN
  -- Normalizar nombre de estado
  normalized_state := normalize_state_name(p_state);
  
  -- Contar total de propiedades en el viewport
  SELECT COUNT(*) INTO total_count
  FROM properties p
  WHERE p.status = 'activa'
    AND p.lat IS NOT NULL 
    AND p.lng IS NOT NULL
    AND p.lat BETWEEN p_south AND p_north
    AND p.lng BETWEEN p_west AND p_east
    AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
    AND (p_property_type IS NULL OR p.type::text = p_property_type)
    AND (p_min_price IS NULL OR p.price >= p_min_price)
    AND (p_max_price IS NULL OR p.price <= p_max_price)
    AND (p_min_bedrooms IS NULL OR p.bedrooms >= p_min_bedrooms)
    AND (p_min_bathrooms IS NULL OR p.bathrooms >= p_min_bathrooms)
    AND (normalized_state IS NULL OR unaccent(LOWER(p.state)) = unaccent(LOWER(normalized_state)))
    AND (p_municipality IS NULL OR unaccent(LOWER(p.municipality)) ILIKE '%' || unaccent(LOWER(p_municipality)) || '%');

  -- Decidir si clusterizar basado en zoom y cantidad
  is_clustered := (p_zoom < 14 AND total_count > 200);
  
  -- Calcular tamaño del grid para clusters
  grid_size := CASE
    WHEN p_zoom <= 6 THEN 3.0
    WHEN p_zoom <= 8 THEN 1.5
    WHEN p_zoom <= 10 THEN 0.5
    WHEN p_zoom <= 12 THEN 0.2
    ELSE 0.1
  END;

  IF is_clustered THEN
    -- Modo cluster: devolver clusters + las primeras 50 propiedades para la lista
    SELECT jsonb_build_object(
      'clusters', COALESCE((
        SELECT jsonb_agg(cluster_data)
        FROM (
          SELECT jsonb_build_object(
            'id', 'cluster-' || ROW_NUMBER() OVER (),
            'lat', AVG(p.lat),
            'lng', AVG(p.lng),
            'property_count', COUNT(*),
            'avg_price', AVG(p.price),
            'expansion_zoom', LEAST(p_zoom + 2, 14)
          ) as cluster_data
          FROM properties p
          WHERE p.status = 'activa'
            AND p.lat IS NOT NULL 
            AND p.lng IS NOT NULL
            AND p.lat BETWEEN p_south AND p_north
            AND p.lng BETWEEN p_west AND p_east
            AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
            AND (p_property_type IS NULL OR p.type::text = p_property_type)
            AND (p_min_price IS NULL OR p.price >= p_min_price)
            AND (p_max_price IS NULL OR p.price <= p_max_price)
            AND (p_min_bedrooms IS NULL OR p.bedrooms >= p_min_bedrooms)
            AND (p_min_bathrooms IS NULL OR p.bathrooms >= p_min_bathrooms)
            AND (normalized_state IS NULL OR unaccent(LOWER(p.state)) = unaccent(LOWER(normalized_state)))
            AND (p_municipality IS NULL OR unaccent(LOWER(p.municipality)) ILIKE '%' || unaccent(LOWER(p_municipality)) || '%')
          GROUP BY FLOOR(p.lat / grid_size), FLOOR(p.lng / grid_size)
          HAVING COUNT(*) > 1
        ) clusters
      ), '[]'::jsonb),
      'properties', COALESCE((
        SELECT jsonb_agg(prop_data)
        FROM (
          SELECT jsonb_build_object(
            'id', p.id,
            'lat', p.lat,
            'lng', p.lng,
            'price', p.price,
            'currency', p.currency,
            'title', p.title,
            'listing_type', p.listing_type,
            'type', p.type,
            'address', p.address,
            'colonia', p.colonia,
            'municipality', p.municipality,
            'state', p.state,
            'bedrooms', p.bedrooms,
            'bathrooms', p.bathrooms,
            'parking', p.parking,
            'sqft', p.sqft,
            'for_sale', p.for_sale,
            'for_rent', p.for_rent,
            'sale_price', p.sale_price,
            'rent_price', p.rent_price,
            'agent_id', p.agent_id,
            'is_featured', EXISTS(
              SELECT 1 FROM featured_properties fp 
              WHERE fp.property_id = p.id 
                AND fp.status = 'active' 
                AND fp.end_date > NOW()
            ),
            'created_at', p.created_at,
            'images', COALESCE((
              SELECT jsonb_agg(jsonb_build_object('url', i.url) ORDER BY i.position)
              FROM images i WHERE i.property_id = p.id
            ), '[]'::jsonb)
          ) as prop_data
          FROM properties p
          WHERE p.status = 'activa'
            AND p.lat IS NOT NULL 
            AND p.lng IS NOT NULL
            AND p.lat BETWEEN p_south AND p_north
            AND p.lng BETWEEN p_west AND p_east
            AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
            AND (p_property_type IS NULL OR p.type::text = p_property_type)
            AND (p_min_price IS NULL OR p.price >= p_min_price)
            AND (p_max_price IS NULL OR p.price <= p_max_price)
            AND (p_min_bedrooms IS NULL OR p.bedrooms >= p_min_bedrooms)
            AND (p_min_bathrooms IS NULL OR p.bathrooms >= p_min_bathrooms)
            AND (normalized_state IS NULL OR unaccent(LOWER(p.state)) = unaccent(LOWER(normalized_state)))
            AND (p_municipality IS NULL OR unaccent(LOWER(p.municipality)) ILIKE '%' || unaccent(LOWER(p_municipality)) || '%')
          ORDER BY 
            EXISTS(SELECT 1 FROM featured_properties fp WHERE fp.property_id = p.id AND fp.status = 'active' AND fp.end_date > NOW()) DESC,
            p.created_at DESC
          LIMIT 50
        ) props
      ), '[]'::jsonb),
      'total_count', total_count,
      'is_clustered', true
    ) INTO result;
  ELSE
    -- Modo individual: devolver todas las propiedades (hasta 500)
    SELECT jsonb_build_object(
      'clusters', '[]'::jsonb,
      'properties', COALESCE((
        SELECT jsonb_agg(prop_data)
        FROM (
          SELECT jsonb_build_object(
            'id', p.id,
            'lat', p.lat,
            'lng', p.lng,
            'price', p.price,
            'currency', p.currency,
            'title', p.title,
            'listing_type', p.listing_type,
            'type', p.type,
            'address', p.address,
            'colonia', p.colonia,
            'municipality', p.municipality,
            'state', p.state,
            'bedrooms', p.bedrooms,
            'bathrooms', p.bathrooms,
            'parking', p.parking,
            'sqft', p.sqft,
            'for_sale', p.for_sale,
            'for_rent', p.for_rent,
            'sale_price', p.sale_price,
            'rent_price', p.rent_price,
            'agent_id', p.agent_id,
            'is_featured', EXISTS(
              SELECT 1 FROM featured_properties fp 
              WHERE fp.property_id = p.id 
                AND fp.status = 'active' 
                AND fp.end_date > NOW()
            ),
            'created_at', p.created_at,
            'images', COALESCE((
              SELECT jsonb_agg(jsonb_build_object('url', i.url) ORDER BY i.position)
              FROM images i WHERE i.property_id = p.id
            ), '[]'::jsonb)
          ) as prop_data
          FROM properties p
          WHERE p.status = 'activa'
            AND p.lat IS NOT NULL 
            AND p.lng IS NOT NULL
            AND p.lat BETWEEN p_south AND p_north
            AND p.lng BETWEEN p_west AND p_east
            AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
            AND (p_property_type IS NULL OR p.type::text = p_property_type)
            AND (p_min_price IS NULL OR p.price >= p_min_price)
            AND (p_max_price IS NULL OR p.price <= p_max_price)
            AND (p_min_bedrooms IS NULL OR p.bedrooms >= p_min_bedrooms)
            AND (p_min_bathrooms IS NULL OR p.bathrooms >= p_min_bathrooms)
            AND (normalized_state IS NULL OR unaccent(LOWER(p.state)) = unaccent(LOWER(normalized_state)))
            AND (p_municipality IS NULL OR unaccent(LOWER(p.municipality)) ILIKE '%' || unaccent(LOWER(p_municipality)) || '%')
          ORDER BY 
            EXISTS(SELECT 1 FROM featured_properties fp WHERE fp.property_id = p.id AND fp.status = 'active' AND fp.end_date > NOW()) DESC,
            p.created_at DESC
          LIMIT 500
        ) props
      ), '[]'::jsonb),
      'total_count', total_count,
      'is_clustered', false
    ) INTO result;
  END IF;

  RETURN result;
END;
$$;
