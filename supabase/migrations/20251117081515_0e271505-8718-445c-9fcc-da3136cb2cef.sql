-- Corregir ambigüedad de nombres en get_map_tiles_cached
CREATE OR REPLACE FUNCTION public.get_map_tiles_cached(
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
  properties jsonb,
  from_cache boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tile_key_computed text;
  v_filters_hash text;
  v_cached_tile record;
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
  -- Generar key única del tile
  v_filters_hash := generate_filters_hash(p_filters);
  v_tile_key_computed := format('tile_%s_%s_%s_%s_z%s_%s', 
    ROUND(p_min_lng::numeric, 4),
    ROUND(p_min_lat::numeric, 4),
    ROUND(p_max_lng::numeric, 4),
    ROUND(p_max_lat::numeric, 4),
    p_zoom,
    v_filters_hash
  );

  -- 🎯 INTENTAR SERVIR DESDE CACHE
  SELECT ptc.* INTO v_cached_tile
  FROM property_tiles_cache ptc
  WHERE ptc.tile_key = v_tile_key_computed
    AND ptc.expires_at > now();

  IF FOUND THEN
    -- ✅ Cache hit: actualizar stats y retornar
    UPDATE property_tiles_cache ptc
    SET 
      last_accessed_at = now(),
      access_count = access_count + 1
    WHERE ptc.tile_key = v_tile_key_computed;

    RETURN QUERY
    SELECT 
      v_tile_key_computed,
      v_cached_tile.zoom,
      v_cached_tile.clusters,
      v_cached_tile.properties,
      true AS from_cache;
    RETURN;
  END IF;

  -- ❌ Cache miss: calcular tile
  v_state := p_filters->>'state';
  v_municipality := p_filters->>'municipality';
  v_listing_type := p_filters->>'listingType';
  v_property_type := p_filters->>'propertyType';
  v_min_price := NULLIF(p_filters->>'minPrice','')::numeric;
  v_max_price := NULLIF(p_filters->>'maxPrice','')::numeric;
  v_min_bedrooms := NULLIF(p_filters->>'minBedrooms','')::integer;
  v_min_bathrooms := NULLIF(p_filters->>'minBathrooms','')::integer;

  IF p_zoom >= 14 THEN
    v_grid_size := 0.02;
  ELSIF p_zoom >= 10 THEN
    v_grid_size := 0.1;
  ELSE
    v_grid_size := 0.25;
  END IF;

  IF p_zoom >= 17 THEN
    -- Propiedades individuales
    RETURN QUERY
    WITH calculated AS (
      SELECT
        NULL::jsonb AS clusters_calc,
        COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', p.id, 'title', p.title, 'price', p.price,
            'lat', p.lat, 'lng', p.lng,
            'property_type', p.type::text, 'listing_type', p.listing_type,
            'bedrooms', p.bedrooms, 'bathrooms', p.bathrooms,
            'parking', p.parking, 'sqft', p.sqft,
            'municipality', p.municipality, 'state', p.state,
            'image_url', (SELECT i.url FROM images i WHERE i.property_id = p.id ORDER BY i.position LIMIT 1),
            'agent_id', p.agent_id,
            'is_featured', EXISTS(SELECT 1 FROM featured_properties fp WHERE fp.property_id = p.id AND fp.status = 'active' AND fp.end_date > now()),
            'created_at', p.created_at
          )
        ), '[]'::jsonb) AS properties_calc
      FROM properties p
      WHERE p.lat IS NOT NULL AND p.lng IS NOT NULL
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
      LIMIT 300
    )
    SELECT 
      v_tile_key_computed,
      p_zoom,
      clusters_calc,
      properties_calc,
      false
    FROM calculated;

    -- Guardar en cache
    INSERT INTO property_tiles_cache (tile_key, zoom, bounds, clusters, properties, property_count, filters_hash)
    SELECT 
      v_tile_key_computed, p_zoom,
      box(point(p_min_lng, p_min_lat), point(p_max_lng, p_max_lat)),
      NULL,
      (SELECT properties_calc FROM calculated),
      jsonb_array_length(COALESCE((SELECT properties_calc FROM calculated), '[]'::jsonb)),
      v_filters_hash
    ON CONFLICT (tile_key) DO UPDATE SET
      properties = EXCLUDED.properties,
      property_count = EXCLUDED.property_count,
      expires_at = now() + interval '5 minutes',
      last_accessed_at = now();
  ELSE
    -- Clusters
    RETURN QUERY
    WITH base AS (
      SELECT p.*, FLOOR(p.lat / v_grid_size) AS lat_bin, FLOOR(p.lng / v_grid_size) AS lng_bin
      FROM properties p
      WHERE p.lat IS NOT NULL AND p.lng IS NOT NULL
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
    ), clusters_calc AS (
      SELECT
        ROUND(AVG(lat)::numeric, 6) AS cluster_lat,
        ROUND(AVG(lng)::numeric, 6) AS cluster_lng,
        COUNT(*)::int AS property_count,
        ROUND(AVG(price)::numeric, 2) AS avg_price
      FROM base
      GROUP BY lat_bin, lng_bin
      HAVING COUNT(*) > 0
    ), calculated AS (
      SELECT
        COALESCE(jsonb_agg(
          jsonb_build_object('lat', cluster_lat, 'lng', cluster_lng, 'count', property_count, 'avg_price', avg_price)
        ), '[]'::jsonb) AS clusters_calc,
        NULL::jsonb AS properties_calc
      FROM clusters_calc
    )
    SELECT v_tile_key_computed, p_zoom, clusters_calc, properties_calc, false
    FROM calculated;

    -- Guardar en cache
    INSERT INTO property_tiles_cache (tile_key, zoom, bounds, clusters, properties, property_count, filters_hash)
    SELECT 
      v_tile_key_computed, p_zoom,
      box(point(p_min_lng, p_min_lat), point(p_max_lng, p_max_lat)),
      (SELECT clusters_calc FROM calculated), NULL,
      COALESCE((SELECT SUM((jsonb_array_elements(clusters_calc)->>'count')::int) FROM calculated), 0),
      v_filters_hash
    ON CONFLICT (tile_key) DO UPDATE SET
      clusters = EXCLUDED.clusters,
      property_count = EXCLUDED.property_count,
      expires_at = now() + interval '5 minutes',
      last_accessed_at = now();
  END IF;
END;
$$;