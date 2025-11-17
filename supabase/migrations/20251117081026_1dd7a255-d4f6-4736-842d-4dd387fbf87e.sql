-- Reemplazar implementación de get_map_tiles manteniendo firma agregada (clusters/properties) y usando status 'activa'
CREATE OR REPLACE FUNCTION public.get_map_tiles(
  p_min_lng numeric,
  p_min_lat numeric,
  p_max_lng numeric,
  p_max_lat numeric,
  p_zoom integer,
  p_filters jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  tile_key text,
  zoom integer,
  clusters jsonb,
  properties jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_state text;
  v_municipality text;
  v_listing_type text;
  v_property_type text;
  v_min_price numeric;
  v_max_price numeric;
  v_min_bedrooms integer;
  v_min_bathrooms integer;
  v_grid_size numeric;
BEGIN
  -- Extraer filtros del JSONB
  v_state := p_filters->>'state';
  v_municipality := p_filters->>'municipality';
  v_listing_type := p_filters->>'listingType';
  v_property_type := p_filters->>'propertyType';
  v_min_price := NULLIF(p_filters->>'minPrice','')::numeric;
  v_max_price := NULLIF(p_filters->>'maxPrice','')::numeric;
  v_min_bedrooms := NULLIF(p_filters->>'minBedrooms','')::integer;
  v_min_bathrooms := NULLIF(p_filters->>'minBathrooms','')::integer;

  -- Grid adaptativo simple por zoom (más fino con más zoom)
  IF p_zoom >= 14 THEN
    v_grid_size := 0.02; -- ~2km
  ELSIF p_zoom >= 10 THEN
    v_grid_size := 0.1;  -- ~10km
  ELSE
    v_grid_size := 0.25; -- ~25km
  END IF;

  IF p_zoom >= 17 THEN
    -- Propiedades individuales agregadas en un array JSONB (una sola fila retornada)
    RETURN QUERY
    SELECT
      'properties'::text AS tile_key,
      p_zoom AS zoom,
      NULL::jsonb AS clusters,
      COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'title', p.title,
          'price', p.price,
          'lat', p.lat,
          'lng', p.lng,
          'property_type', p.type::text,
          'listing_type', p.listing_type,
          'bedrooms', p.bedrooms,
          'bathrooms', p.bathrooms,
          'parking', p.parking,
          'sqft', p.sqft,
          'municipality', p.municipality,
          'state', p.state,
          'image_url', (
            SELECT i.url FROM images i
            WHERE i.property_id = p.id
            ORDER BY i.position
            LIMIT 1
          ),
          'agent_id', p.agent_id,
          'is_featured', EXISTS(
            SELECT 1 FROM featured_properties fp
            WHERE fp.property_id = p.id AND fp.status = 'active' AND fp.end_date > now()
          ),
          'created_at', p.created_at
        )
      ), '[]'::jsonb) AS properties
    FROM properties p
    WHERE p.lat IS NOT NULL
      AND p.lng IS NOT NULL
      AND p.status = 'activa'
      AND p.lat BETWEEN p_min_lat AND p_max_lat
      AND p.lng BETWEEN p_min_lng AND p_max_lng
      AND (v_state IS NULL OR p.state = v_state)
      AND (v_municipality IS NULL OR p.municipality = v_municipality)
      AND (v_listing_type IS NULL OR p.listing_type = v_listing_type)
      AND (v_property_type IS NULL OR p.type::text = v_property_type)
      AND (v_min_price IS NULL OR p.price >= v_min_price)
      AND (v_max_price IS NULL OR p.price <= v_max_price)
      AND (v_min_bedrooms IS NULL OR p.bedrooms >= v_min_bedrooms)
      AND (v_min_bathrooms IS NULL OR p.bathrooms >= v_min_bathrooms)
    LIMIT 300;
  ELSE
    -- Clusters agregados como array JSONB (una sola fila retornada)
    RETURN QUERY
    WITH base AS (
      SELECT
        p.*,
        FLOOR(p.lat / v_grid_size) AS lat_bin,
        FLOOR(p.lng / v_grid_size) AS lng_bin
      FROM properties p
      WHERE p.lat IS NOT NULL
        AND p.lng IS NOT NULL
        AND p.status = 'activa'
        AND p.lat BETWEEN p_min_lat AND p_max_lat
        AND p.lng BETWEEN p_min_lng AND p_max_lng
        AND (v_state IS NULL OR p.state = v_state)
        AND (v_municipality IS NULL OR p.municipality = v_municipality)
        AND (v_listing_type IS NULL OR p.listing_type = v_listing_type)
        AND (v_property_type IS NULL OR p.type::text = v_property_type)
        AND (v_min_price IS NULL OR p.price >= v_min_price)
        AND (v_max_price IS NULL OR p.price <= v_max_price)
        AND (v_min_bedrooms IS NULL OR p.bedrooms >= v_min_bedrooms)
        AND (v_min_bathrooms IS NULL OR p.bathrooms >= v_min_bathrooms)
    ), clusters AS (
      SELECT
        ROUND(AVG(lat)::numeric, 6) AS cluster_lat,
        ROUND(AVG(lng)::numeric, 6) AS cluster_lng,
        COUNT(*)::int AS property_count,
        ROUND(AVG(price)::numeric, 2) AS avg_price
      FROM base
      GROUP BY lat_bin, lng_bin
      HAVING COUNT(*) > 0
    )
    SELECT
      'clustered'::text AS tile_key,
      p_zoom AS zoom,
      COALESCE(jsonb_agg(
        jsonb_build_object(
          'lat', cluster_lat,
          'lng', cluster_lng,
          'count', property_count,
          'avg_price', avg_price
        )
      ), '[]'::jsonb) AS clusters,
      NULL::jsonb AS properties
    FROM clusters;
  END IF;
END;
$$;