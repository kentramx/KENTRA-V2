-- =====================================================
-- FUNCIÓN RPC: get_map_data
-- Clustering server-side para millones de propiedades
-- =====================================================

CREATE OR REPLACE FUNCTION get_map_data(
  p_north DOUBLE PRECISION,
  p_south DOUBLE PRECISION,
  p_east DOUBLE PRECISION,
  p_west DOUBLE PRECISION,
  p_zoom INTEGER DEFAULT 10,
  p_listing_type TEXT DEFAULT NULL,
  p_property_type TEXT DEFAULT NULL,
  p_price_min NUMERIC DEFAULT NULL,
  p_price_max NUMERIC DEFAULT NULL,
  p_bedrooms_min INTEGER DEFAULT NULL,
  p_bathrooms_min INTEGER DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_municipality TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_result JSONB;
  v_grid_size DOUBLE PRECISION;
  v_total_count INTEGER;
  v_cluster_threshold INTEGER := 14;
  v_max_properties INTEGER := 500;
  v_max_clusters INTEGER := 200;
BEGIN
  -- Calcular tamaño de grid según zoom
  v_grid_size := CASE
    WHEN p_zoom <= 6 THEN 5.0
    WHEN p_zoom <= 8 THEN 2.0
    WHEN p_zoom <= 10 THEN 1.0
    WHEN p_zoom <= 12 THEN 0.5
    WHEN p_zoom <= 14 THEN 0.1
    ELSE 0.02
  END;

  -- Contar total en el área
  SELECT COUNT(*)::INTEGER INTO v_total_count
  FROM properties p
  WHERE p.lat BETWEEN p_south AND p_north
    AND p.lng BETWEEN p_west AND p_east
    AND p.status = 'activa'
    AND p.lat IS NOT NULL
    AND p.lng IS NOT NULL
    AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
    AND (p_property_type IS NULL OR p.type::text = p_property_type)
    AND (p_price_min IS NULL OR p.price >= p_price_min)
    AND (p_price_max IS NULL OR p.price <= p_price_max)
    AND (p_bedrooms_min IS NULL OR p.bedrooms >= p_bedrooms_min)
    AND (p_bathrooms_min IS NULL OR p.bathrooms >= p_bathrooms_min)
    AND (p_state IS NULL OR p.state = p_state)
    AND (p_municipality IS NULL OR p.municipality = p_municipality);

  -- Si zoom alto O pocas propiedades -> devolver individuales
  IF p_zoom >= v_cluster_threshold OR v_total_count <= v_max_properties THEN
    SELECT jsonb_build_object(
      'is_clustered', false,
      'total_count', v_total_count,
      'clusters', '[]'::jsonb,
      'properties', COALESCE(
        (
          SELECT jsonb_agg(prop ORDER BY (prop->>'price')::numeric DESC)
          FROM (
            SELECT jsonb_build_object(
              'id', p.id,
              'lat', p.lat,
              'lng', p.lng,
              'price', p.price,
              'type', p.type,
              'title', p.title,
              'bedrooms', p.bedrooms,
              'bathrooms', p.bathrooms,
              'area', p.sqft,
              'image_url', (
                SELECT i.url FROM images i 
                WHERE i.property_id = p.id 
                ORDER BY i.position 
                LIMIT 1
              )
            ) as prop
            FROM properties p
            WHERE p.lat BETWEEN p_south AND p_north
              AND p.lng BETWEEN p_west AND p_east
              AND p.status = 'activa'
              AND p.lat IS NOT NULL
              AND p.lng IS NOT NULL
              AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
              AND (p_property_type IS NULL OR p.type::text = p_property_type)
              AND (p_price_min IS NULL OR p.price >= p_price_min)
              AND (p_price_max IS NULL OR p.price <= p_price_max)
              AND (p_bedrooms_min IS NULL OR p.bedrooms >= p_bedrooms_min)
              AND (p_bathrooms_min IS NULL OR p.bathrooms >= p_bathrooms_min)
              AND (p_state IS NULL OR p.state = p_state)
              AND (p_municipality IS NULL OR p.municipality = p_municipality)
            ORDER BY p.created_at DESC
            LIMIT v_max_properties
          ) sub
        ),
        '[]'::jsonb
      )
    ) INTO v_result;
  ELSE
    -- Devolver clusters
    SELECT jsonb_build_object(
      'is_clustered', true,
      'total_count', v_total_count,
      'properties', '[]'::jsonb,
      'clusters', COALESCE(
        (
          SELECT jsonb_agg(cluster_row ORDER BY (cluster_row->>'count')::int DESC)
          FROM (
            SELECT jsonb_build_object(
              'id', CONCAT(FLOOR(p.lat / v_grid_size)::TEXT, '_', FLOOR(p.lng / v_grid_size)::TEXT),
              'lat', AVG(p.lat),
              'lng', AVG(p.lng),
              'count', COUNT(*),
              'min_price', MIN(p.price),
              'max_price', MAX(p.price),
              'expansion_zoom', LEAST(p_zoom + 2, 18)
            ) as cluster_row
            FROM properties p
            WHERE p.lat BETWEEN p_south AND p_north
              AND p.lng BETWEEN p_west AND p_east
              AND p.status = 'activa'
              AND p.lat IS NOT NULL
              AND p.lng IS NOT NULL
              AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
              AND (p_property_type IS NULL OR p.type::text = p_property_type)
              AND (p_price_min IS NULL OR p.price >= p_price_min)
              AND (p_price_max IS NULL OR p.price <= p_price_max)
              AND (p_bedrooms_min IS NULL OR p.bedrooms >= p_bedrooms_min)
              AND (p_bathrooms_min IS NULL OR p.bathrooms >= p_bathrooms_min)
              AND (p_state IS NULL OR p.state = p_state)
              AND (p_municipality IS NULL OR p.municipality = p_municipality)
            GROUP BY FLOOR(p.lat / v_grid_size), FLOOR(p.lng / v_grid_size)
            ORDER BY COUNT(*) DESC
            LIMIT v_max_clusters
          ) sub
        ),
        '[]'::jsonb
      )
    ) INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;

-- =====================================================
-- ÍNDICES OPTIMIZADOS PARA MILLONES DE PROPIEDADES
-- =====================================================

-- Índice BRIN para coordenadas (extremadamente eficiente para rangos)
DROP INDEX IF EXISTS idx_properties_coords_brin;
CREATE INDEX idx_properties_coords_brin ON properties 
USING BRIN (lat, lng) 
WITH (pages_per_range = 32)
WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Índice compuesto para filtros + coordenadas
DROP INDEX IF EXISTS idx_properties_map_search;
CREATE INDEX idx_properties_map_search ON properties 
(status, listing_type, type, price, bedrooms, bathrooms)
WHERE status = 'activa' AND lat IS NOT NULL AND lng IS NOT NULL;

-- Índice para estado/municipio
DROP INDEX IF EXISTS idx_properties_location_map;
CREATE INDEX idx_properties_location_map ON properties 
(state, municipality)
WHERE status = 'activa' AND lat IS NOT NULL AND lng IS NOT NULL;

-- Actualizar estadísticas
ANALYZE properties;