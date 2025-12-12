-- Corregir el error de enum: cambiar 'active' por 'activa' en get_map_data
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
  grid_size double precision;
  result jsonb;
  property_count integer;
  cluster_threshold integer := 500;
BEGIN
  -- Calcular tamaño de grid dinámico basado en zoom
  grid_size := CASE
    WHEN p_zoom >= 16 THEN 0.001
    WHEN p_zoom >= 14 THEN 0.005
    WHEN p_zoom >= 12 THEN 0.01
    WHEN p_zoom >= 10 THEN 0.05
    WHEN p_zoom >= 8 THEN 0.1
    WHEN p_zoom >= 6 THEN 0.5
    ELSE 1.0
  END;

  -- Contar propiedades en el viewport
  SELECT COUNT(*) INTO property_count
  FROM properties p
  WHERE p.lat IS NOT NULL
    AND p.lng IS NOT NULL
    AND p.lat BETWEEN p_south AND p_north
    AND p.lng BETWEEN p_west AND p_east
    AND p.status = 'approved'
    AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
    AND (p_property_type IS NULL OR p.type::text = p_property_type)
    AND (p_min_price IS NULL OR p.price >= p_min_price)
    AND (p_max_price IS NULL OR p.price <= p_max_price)
    AND (p_bedrooms IS NULL OR p.bedrooms >= p_bedrooms)
    AND (p_bathrooms IS NULL OR p.bathrooms >= p_bathrooms)
    AND (p_state IS NULL OR p.state ILIKE p_state)
    AND (p_municipality IS NULL OR p.municipality ILIKE p_municipality);

  -- Si zoom alto o pocas propiedades, devolver individuales
  IF p_zoom >= 14 OR property_count <= cluster_threshold THEN
    SELECT jsonb_build_object(
      'properties', COALESCE(jsonb_agg(prop_data), '[]'::jsonb),
      'clusters', '[]'::jsonb,
      'total_count', property_count,
      'is_clustered', false
    ) INTO result
    FROM (
      SELECT jsonb_build_object(
        'id', p.id,
        'lat', p.lat,
        'lng', p.lng,
        'price', p.price,
        'currency', p.currency,
        'type', p.type::text,
        'title', p.title,
        'listing_type', p.listing_type,
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
        'created_at', p.created_at,
        'is_featured', EXISTS(
          SELECT 1 FROM featured_properties fp 
          WHERE fp.property_id = p.id 
          AND fp.end_date > now() 
          AND fp.status = 'activa'
        ),
        'image_url', (SELECT url FROM images WHERE property_id = p.id ORDER BY position LIMIT 1),
        'images', COALESCE(
          (SELECT jsonb_agg(jsonb_build_object('url', i.url)) 
           FROM images i WHERE i.property_id = p.id ORDER BY i.position),
          '[]'::jsonb
        )
      ) as prop_data
      FROM properties p
      WHERE p.lat IS NOT NULL
        AND p.lng IS NOT NULL
        AND p.lat BETWEEN p_south AND p_north
        AND p.lng BETWEEN p_west AND p_east
        AND p.status = 'approved'
        AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
        AND (p_property_type IS NULL OR p.type::text = p_property_type)
        AND (p_min_price IS NULL OR p.price >= p_min_price)
        AND (p_max_price IS NULL OR p.price <= p_max_price)
        AND (p_bedrooms IS NULL OR p.bedrooms >= p_bedrooms)
        AND (p_bathrooms IS NULL OR p.bathrooms >= p_bathrooms)
        AND (p_state IS NULL OR p.state ILIKE p_state)
        AND (p_municipality IS NULL OR p.municipality ILIKE p_municipality)
      ORDER BY 
        EXISTS(
          SELECT 1 FROM featured_properties fp 
          WHERE fp.property_id = p.id 
          AND fp.end_date > now() 
          AND fp.status = 'activa'
        ) DESC,
        p.created_at DESC
      LIMIT 1000
    ) subq;
  ELSE
    -- Devolver clusters
    SELECT jsonb_build_object(
      'properties', '[]'::jsonb,
      'clusters', COALESCE(jsonb_agg(cluster_data), '[]'::jsonb),
      'total_count', property_count,
      'is_clustered', true
    ) INTO result
    FROM (
      SELECT jsonb_build_object(
        'id', 'cluster_' || row_number() over(),
        'lat', AVG(p.lat),
        'lng', AVG(p.lng),
        'property_count', COUNT(*),
        'min_price', MIN(p.price),
        'max_price', MAX(p.price),
        'expansion_zoom', LEAST(p_zoom + 2, 16)
      ) as cluster_data
      FROM properties p
      WHERE p.lat IS NOT NULL
        AND p.lng IS NOT NULL
        AND p.lat BETWEEN p_south AND p_north
        AND p.lng BETWEEN p_west AND p_east
        AND p.status = 'approved'
        AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
        AND (p_property_type IS NULL OR p.type::text = p_property_type)
        AND (p_min_price IS NULL OR p.price >= p_min_price)
        AND (p_max_price IS NULL OR p.price <= p_max_price)
        AND (p_bedrooms IS NULL OR p.bedrooms >= p_bedrooms)
        AND (p_bathrooms IS NULL OR p.bathrooms >= p_bathrooms)
        AND (p_state IS NULL OR p.state ILIKE p_state)
        AND (p_municipality IS NULL OR p.municipality ILIKE p_municipality)
      GROUP BY 
        floor(p.lat / grid_size),
        floor(p.lng / grid_size)
      HAVING COUNT(*) > 0
    ) subq;
  END IF;

  RETURN COALESCE(result, jsonb_build_object(
    'properties', '[]'::jsonb,
    'clusters', '[]'::jsonb,
    'total_count', 0,
    'is_clustered', false
  ));
END;
$$;