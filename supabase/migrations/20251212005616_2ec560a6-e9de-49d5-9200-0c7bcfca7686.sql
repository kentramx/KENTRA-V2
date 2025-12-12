-- Eliminar función existente y recrearla con campos adicionales
DROP FUNCTION IF EXISTS get_map_data(FLOAT, FLOAT, FLOAT, FLOAT, INT, TEXT, TEXT, NUMERIC, NUMERIC, INT, INT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_map_data(
  p_north FLOAT,
  p_south FLOAT,
  p_east FLOAT,
  p_west FLOAT,
  p_zoom INT,
  p_listing_type TEXT DEFAULT NULL,
  p_property_type TEXT DEFAULT NULL,
  p_min_price NUMERIC DEFAULT NULL,
  p_max_price NUMERIC DEFAULT NULL,
  p_bedrooms INT DEFAULT NULL,
  p_bathrooms INT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_municipality TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grid_size FLOAT;
  v_result JSONB;
  v_property_count INT;
  v_max_markers INT := 500;
BEGIN
  -- Calcular tamaño de grid basado en zoom
  v_grid_size := CASE
    WHEN p_zoom < 8 THEN 2.0
    WHEN p_zoom < 10 THEN 1.0
    WHEN p_zoom < 12 THEN 0.5
    WHEN p_zoom < 14 THEN 0.1
    ELSE 0.05
  END;

  -- Contar propiedades en viewport
  SELECT COUNT(*) INTO v_property_count
  FROM properties p
  WHERE p.lat BETWEEN p_south AND p_north
    AND p.lng BETWEEN p_west AND p_east
    AND p.status IN ('activa', 'active', 'published')
    AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
    AND (p_property_type IS NULL OR p.type::text = p_property_type)
    AND (p_min_price IS NULL OR p.price >= p_min_price)
    AND (p_max_price IS NULL OR p.price <= p_max_price)
    AND (p_bedrooms IS NULL OR p.bedrooms >= p_bedrooms)
    AND (p_bathrooms IS NULL OR p.bathrooms >= p_bathrooms)
    AND (p_state IS NULL OR p.state ILIKE p_state)
    AND (p_municipality IS NULL OR p.municipality ILIKE p_municipality);

  -- Si hay pocas propiedades o zoom alto, devolver propiedades individuales
  IF v_property_count <= v_max_markers OR p_zoom >= 14 THEN
    SELECT jsonb_build_object(
      'properties', COALESCE(jsonb_agg(prop_data), '[]'::jsonb),
      'clusters', '[]'::jsonb,
      'total_in_viewport', v_property_count,
      'truncated', v_property_count > v_max_markers
    ) INTO v_result
    FROM (
      SELECT jsonb_build_object(
        'id', p.id,
        'lat', p.lat,
        'lng', p.lng,
        'price', p.price,
        'currency', COALESCE(p.currency, 'MXN'),
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
        'created_at', p.created_at,
        'is_featured', EXISTS (
          SELECT 1 FROM featured_properties fp 
          WHERE fp.property_id = p.id 
          AND fp.status = 'active' 
          AND fp.end_date > NOW()
        ),
        'image_url', (
          SELECT i.url FROM images i 
          WHERE i.property_id = p.id 
          ORDER BY i.position NULLS LAST, i.created_at 
          LIMIT 1
        ),
        'images', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object('url', i.url) ORDER BY i.position NULLS LAST, i.created_at), '[]'::jsonb)
          FROM images i WHERE i.property_id = p.id
        )
      ) AS prop_data
      FROM properties p
      WHERE p.lat BETWEEN p_south AND p_north
        AND p.lng BETWEEN p_west AND p_east
        AND p.status IN ('activa', 'active', 'published')
        AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
        AND (p_property_type IS NULL OR p.type::text = p_property_type)
        AND (p_min_price IS NULL OR p.price >= p_min_price)
        AND (p_max_price IS NULL OR p.price <= p_max_price)
        AND (p_bedrooms IS NULL OR p.bedrooms >= p_bedrooms)
        AND (p_bathrooms IS NULL OR p.bathrooms >= p_bathrooms)
        AND (p_state IS NULL OR p.state ILIKE p_state)
        AND (p_municipality IS NULL OR p.municipality ILIKE p_municipality)
      ORDER BY 
        EXISTS (
          SELECT 1 FROM featured_properties fp 
          WHERE fp.property_id = p.id 
          AND fp.status = 'active' 
          AND fp.end_date > NOW()
        ) DESC,
        p.created_at DESC
      LIMIT v_max_markers
    ) sub;
  ELSE
    -- Devolver clusters
    SELECT jsonb_build_object(
      'properties', '[]'::jsonb,
      'clusters', COALESCE(jsonb_agg(cluster_data), '[]'::jsonb),
      'total_in_viewport', v_property_count,
      'truncated', false
    ) INTO v_result
    FROM (
      SELECT jsonb_build_object(
        'id', 'cluster_' || FLOOR(p.lat / v_grid_size)::text || '_' || FLOOR(p.lng / v_grid_size)::text,
        'lat', AVG(p.lat),
        'lng', AVG(p.lng),
        'count', COUNT(*),
        'avg_price', AVG(p.price),
        'expansion_zoom', LEAST(p_zoom + 2, 14)
      ) AS cluster_data
      FROM properties p
      WHERE p.lat BETWEEN p_south AND p_north
        AND p.lng BETWEEN p_west AND p_east
        AND p.status IN ('activa', 'active', 'published')
        AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
        AND (p_property_type IS NULL OR p.type::text = p_property_type)
        AND (p_min_price IS NULL OR p.price >= p_min_price)
        AND (p_max_price IS NULL OR p.price <= p_max_price)
        AND (p_bedrooms IS NULL OR p.bedrooms >= p_bedrooms)
        AND (p_bathrooms IS NULL OR p.bathrooms >= p_bathrooms)
        AND (p_state IS NULL OR p.state ILIKE p_state)
        AND (p_municipality IS NULL OR p.municipality ILIKE p_municipality)
      GROUP BY FLOOR(p.lat / v_grid_size), FLOOR(p.lng / v_grid_size)
      HAVING COUNT(*) > 0
    ) sub;
  END IF;

  RETURN v_result;
END;
$$;