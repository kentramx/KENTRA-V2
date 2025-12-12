-- =====================================================
-- SISTEMA DE NORMALIZACIÓN DE UBICACIONES PARA KENTRA
-- =====================================================

-- PASO 1: Crear función normalize_location
CREATE OR REPLACE FUNCTION normalize_location(input_text text, location_type text DEFAULT 'general')
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Normalizar: minúsculas, sin acentos, sin espacios extra
  input_text := TRIM(unaccent(LOWER(input_text)));
  
  -- Para COLONIAS: remover prefijos comunes
  IF location_type = 'colonia' THEN
    input_text := REGEXP_REPLACE(input_text, '^(col\.?\s*|colonia\s+|fracc\.?\s*|fraccionamiento\s+|residencial\s+|unidad\s+habitacional\s+|u\.?\s*h\.?\s*|privada\s+|conjunto\s+|villa\s+|villas\s+|jardines\s+(de\s+)?|lomas\s+(de\s+)?|bosques\s+(de\s+)?)', '', 'i');
    RETURN input_text;
  END IF;
  
  -- Para ESTADOS: mapeo de aliases
  IF location_type = 'state' THEN
    RETURN CASE input_text
      WHEN 'mexico city' THEN 'ciudad de mexico'
      WHEN 'cdmx' THEN 'ciudad de mexico'
      WHEN 'distrito federal' THEN 'ciudad de mexico'
      WHEN 'df' THEN 'ciudad de mexico'
      WHEN 'state of mexico' THEN 'estado de mexico'
      WHEN 'mexico state' THEN 'estado de mexico'
      WHEN 'nuevo leon' THEN 'nuevo leon'
      WHEN 'san luis potosi' THEN 'san luis potosi'
      WHEN 'quintana roo' THEN 'quintana roo'
      WHEN 'baja california sur' THEN 'baja california sur'
      WHEN 'baja california norte' THEN 'baja california'
      ELSE input_text
    END;
  END IF;
  
  -- Para MUNICIPIOS: mapeo de nombres turísticos/comunes → nombres oficiales
  IF location_type = 'municipality' THEN
    RETURN CASE input_text
      -- Quintana Roo
      WHEN 'cancun' THEN 'benito juarez'
      WHEN 'playa del carmen' THEN 'solidaridad'
      WHEN 'puerto morelos' THEN 'puerto morelos'
      -- Guanajuato
      WHEN 'leon' THEN 'leon de los aldama'
      WHEN 'san miguel allende' THEN 'san miguel de allende'
      -- Baja California Sur
      WHEN 'cabo san lucas' THEN 'los cabos'
      WHEN 'san jose del cabo' THEN 'los cabos'
      -- Nayarit
      WHEN 'punta mita' THEN 'bahia de banderas'
      WHEN 'sayulita' THEN 'bahia de banderas'
      WHEN 'nuevo vallarta' THEN 'bahia de banderas'
      -- Jalisco
      WHEN 'vallarta' THEN 'puerto vallarta'
      -- CDMX delegaciones/colonias comunes → alcaldía
      WHEN 'polanco' THEN 'miguel hidalgo'
      WHEN 'condesa' THEN 'cuauhtemoc'
      WHEN 'roma' THEN 'cuauhtemoc'
      WHEN 'roma norte' THEN 'cuauhtemoc'
      WHEN 'roma sur' THEN 'cuauhtemoc'
      WHEN 'santa fe' THEN 'alvaro obregon'
      WHEN 'san angel' THEN 'alvaro obregon'
      WHEN 'del valle' THEN 'benito juarez'
      WHEN 'narvarte' THEN 'benito juarez'
      ELSE input_text
    END;
  END IF;
  
  -- Default: solo normalizar
  RETURN input_text;
END;
$$;

-- PASO 2: Recrear get_map_data con p_colonia y normalize_location
DROP FUNCTION IF EXISTS get_map_data(double precision, double precision, double precision, double precision, integer, text, text, numeric, numeric, integer, integer, text, text);

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
  p_municipality text DEFAULT NULL,
  p_colonia text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result json;
  property_count integer;
  grid_size double precision;
  should_cluster boolean;
  norm_state text;
  norm_municipality text;
  norm_colonia text;
BEGIN
  -- Pre-normalizar inputs para reusar
  norm_state := normalize_location(p_state, 'state');
  norm_municipality := normalize_location(p_municipality, 'municipality');
  norm_colonia := normalize_location(p_colonia, 'colonia');

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
    AND (norm_state IS NULL OR normalize_location(p.state, 'state') LIKE '%' || norm_state || '%')
    AND (norm_municipality IS NULL OR normalize_location(p.municipality, 'municipality') LIKE '%' || norm_municipality || '%')
    AND (norm_colonia IS NULL OR normalize_location(p.colonia, 'colonia') LIKE '%' || norm_colonia || '%');

  should_cluster := p_zoom < 14 AND property_count > 200;

  IF NOT should_cluster THEN
    SELECT json_build_object(
      'properties', COALESCE((
        SELECT json_agg(prop_data)
        FROM (
          SELECT json_build_object(
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
            'parking', p.parking,
            'listing_type', p.listing_type,
            'address', p.address,
            'colonia', p.colonia,
            'state', p.state,
            'municipality', p.municipality,
            'for_sale', p.for_sale,
            'for_rent', p.for_rent,
            'sale_price', p.sale_price,
            'rent_price', p.rent_price,
            'images', COALESCE((
              SELECT json_agg(json_build_object('url', i.url) ORDER BY i.position)
              FROM images i WHERE i.property_id = p.id
            ), '[]'::json),
            'agent_id', p.agent_id,
            'is_featured', EXISTS(
              SELECT 1 FROM featured_properties fp 
              WHERE fp.property_id = p.id 
              AND fp.status = 'active' 
              AND fp.end_date > NOW()
            ),
            'created_at', p.created_at
          ) as prop_data
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
            AND (norm_state IS NULL OR normalize_location(p.state, 'state') LIKE '%' || norm_state || '%')
            AND (norm_municipality IS NULL OR normalize_location(p.municipality, 'municipality') LIKE '%' || norm_municipality || '%')
            AND (norm_colonia IS NULL OR normalize_location(p.colonia, 'colonia') LIKE '%' || norm_colonia || '%')
          ORDER BY 
            EXISTS(SELECT 1 FROM featured_properties fp WHERE fp.property_id = p.id AND fp.status = 'active' AND fp.end_date > NOW()) DESC,
            p.created_at DESC
          LIMIT 200
        ) subq
      ), '[]'::json),
      'clusters', '[]'::json,
      'total_count', property_count,
      'is_clustered', false
    ) INTO result;
  ELSE
    SELECT json_build_object(
      'properties', COALESCE((
        SELECT json_agg(prop_data)
        FROM (
          SELECT json_build_object(
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
            'parking', p.parking,
            'listing_type', p.listing_type,
            'address', p.address,
            'colonia', p.colonia,
            'state', p.state,
            'municipality', p.municipality,
            'for_sale', p.for_sale,
            'for_rent', p.for_rent,
            'sale_price', p.sale_price,
            'rent_price', p.rent_price,
            'images', COALESCE((
              SELECT json_agg(json_build_object('url', i.url) ORDER BY i.position)
              FROM images i WHERE i.property_id = p.id
            ), '[]'::json),
            'agent_id', p.agent_id,
            'is_featured', EXISTS(
              SELECT 1 FROM featured_properties fp 
              WHERE fp.property_id = p.id 
              AND fp.status = 'active' 
              AND fp.end_date > NOW()
            ),
            'created_at', p.created_at
          ) as prop_data
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
            AND (norm_state IS NULL OR normalize_location(p.state, 'state') LIKE '%' || norm_state || '%')
            AND (norm_municipality IS NULL OR normalize_location(p.municipality, 'municipality') LIKE '%' || norm_municipality || '%')
            AND (norm_colonia IS NULL OR normalize_location(p.colonia, 'colonia') LIKE '%' || norm_colonia || '%')
          ORDER BY 
            EXISTS(SELECT 1 FROM featured_properties fp WHERE fp.property_id = p.id AND fp.status = 'active' AND fp.end_date > NOW()) DESC,
            p.created_at DESC
          LIMIT 50
        ) subq
      ), '[]'::json),
      'clusters', COALESCE((
        SELECT json_agg(json_build_object(
          'lat', cluster_lat,
          'lng', cluster_lng,
          'property_count', cnt,
          'expansion_zoom', LEAST(p_zoom + 2, 14)
        ))
        FROM (
          SELECT 
            ROUND(p.lat / grid_size) * grid_size + grid_size / 2 as cluster_lat,
            ROUND(p.lng / grid_size) * grid_size + grid_size / 2 as cluster_lng,
            COUNT(*) as cnt
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
            AND (norm_state IS NULL OR normalize_location(p.state, 'state') LIKE '%' || norm_state || '%')
            AND (norm_municipality IS NULL OR normalize_location(p.municipality, 'municipality') LIKE '%' || norm_municipality || '%')
            AND (norm_colonia IS NULL OR normalize_location(p.colonia, 'colonia') LIKE '%' || norm_colonia || '%')
          GROUP BY ROUND(p.lat / grid_size), ROUND(p.lng / grid_size)
          HAVING COUNT(*) > 0
          ORDER BY COUNT(*) DESC
          LIMIT 200
        ) clusters_subq
      ), '[]'::json),
      'total_count', property_count,
      'is_clustered', true
    ) INTO result;
  END IF;

  RETURN result;
END;
$$;