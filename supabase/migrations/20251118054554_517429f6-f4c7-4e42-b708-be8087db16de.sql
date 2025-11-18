-- 🔧 Fix: Hacer get_map_tiles tolerante a listingType en inglés y español
-- Problema: Frontend enviaba 'sale'/'rent' pero backend esperaba 'venta'/'renta'
-- Solución: Backend mapea automáticamente 'sale' → 'venta', 'rent' → 'renta'

CREATE OR REPLACE FUNCTION get_map_tiles(
  p_min_lng DOUBLE PRECISION,
  p_min_lat DOUBLE PRECISION,
  p_max_lng DOUBLE PRECISION,
  p_max_lat DOUBLE PRECISION,
  p_zoom INTEGER,
  p_filters JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clusters JSONB;
  v_properties JSONB;
  v_cluster_threshold INTEGER;
  v_tile_key TEXT;
  v_filters_hash TEXT;
  v_cached_result JSONB;
  v_status TEXT[];
BEGIN
  -- ✅ Normalizar listingType: aceptar tanto español como inglés
  IF p_filters ? 'listingType' THEN
    IF p_filters->>'listingType' = 'sale' THEN
      p_filters := jsonb_set(p_filters, '{listingType}', '"venta"'::jsonb);
    ELSIF p_filters->>'listingType' = 'rent' THEN
      p_filters := jsonb_set(p_filters, '{listingType}', '"renta"'::jsonb);
    END IF;
  END IF;

  -- Generar tile_key y filters_hash para cache
  v_tile_key := format('t_%s_%s_%s_%s_z%s', 
    FLOOR(p_min_lng)::TEXT,
    FLOOR(p_min_lat)::TEXT,
    FLOOR(p_max_lng)::TEXT,
    FLOOR(p_max_lat)::TEXT,
    p_zoom::TEXT
  );
  
  v_filters_hash := MD5(p_filters::TEXT);

  -- 🔥 Intentar obtener del cache (5 minutos TTL)
  SELECT 
    jsonb_build_object(
      'clusters', clusters,
      'properties', properties
    )
  INTO v_cached_result
  FROM property_tiles_cache
  WHERE tile_key = v_tile_key
    AND filters_hash = v_filters_hash
    AND expires_at > NOW()
  LIMIT 1;

  IF v_cached_result IS NOT NULL THEN
    -- ✅ Cache hit: actualizar last_accessed_at y access_count
    UPDATE property_tiles_cache
    SET 
      last_accessed_at = NOW(),
      access_count = access_count + 1
    WHERE tile_key = v_tile_key AND filters_hash = v_filters_hash;
    
    RETURN v_cached_result;
  END IF;

  -- 🎯 Cache miss: calcular datos
  v_status := ARRAY['published'::property_status];

  -- Determinar threshold de clustering según zoom
  v_cluster_threshold := CASE
    WHEN p_zoom >= 15 THEN 0
    WHEN p_zoom >= 12 THEN 3
    WHEN p_zoom >= 8 THEN 10
    ELSE 20
  END;

  -- Obtener clusters (propiedades agrupadas)
  WITH clustered AS (
    SELECT
      ROUND(AVG(p.lat)::numeric, 6)::double precision AS lat,
      ROUND(AVG(p.lng)::numeric, 6)::double precision AS lng,
      COUNT(*)::integer AS count,
      ROUND(AVG(p.price)::numeric, 2)::double precision AS avg_price
    FROM properties p
    WHERE p.lat BETWEEN p_min_lat AND p_max_lat
      AND p.lng BETWEEN p_min_lng AND p_max_lng
      AND p.status::text = ANY(v_status)
      AND p.lat IS NOT NULL
      AND p.lng IS NOT NULL
      AND (p_filters->>'state' IS NULL OR p.state = p_filters->>'state')
      AND (p_filters->>'municipality' IS NULL OR p.municipality = p_filters->>'municipality')
      AND (p_filters->>'listingType' IS NULL OR p.listing_type = p_filters->>'listingType')
      AND (p_filters->>'propertyType' IS NULL OR p.type::text = p_filters->>'propertyType')
      AND (p_filters->>'minPrice' IS NULL OR p.price >= (p_filters->>'minPrice')::numeric)
      AND (p_filters->>'maxPrice' IS NULL OR p.price <= (p_filters->>'maxPrice')::numeric)
      AND (p_filters->>'minBedrooms' IS NULL OR p.bedrooms >= (p_filters->>'minBedrooms')::integer)
      AND (p_filters->>'minBathrooms' IS NULL OR p.bathrooms >= (p_filters->>'minBathrooms')::integer)
    GROUP BY FLOOR(p.lat * 1000), FLOOR(p.lng * 1000)
    HAVING COUNT(*) >= v_cluster_threshold
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'lat', lat,
      'lng', lng,
      'count', count,
      'avgPrice', avg_price
    )
  ), '[]'::jsonb)
  INTO v_clusters
  FROM clustered;

  -- Obtener propiedades individuales (no agrupadas)
  WITH individual_properties AS (
    SELECT
      p.id,
      p.title,
      p.lat,
      p.lng,
      p.price,
      p.currency,
      p.type,
      p.bedrooms,
      p.bathrooms,
      COALESCE(
        (SELECT url FROM images WHERE property_id = p.id ORDER BY position LIMIT 1),
        '/placeholder.svg'
      ) AS main_image
    FROM properties p
    WHERE p.lat BETWEEN p_min_lat AND p_max_lat
      AND p.lng BETWEEN p_min_lng AND p_max_lng
      AND p.status::text = ANY(v_status)
      AND p.lat IS NOT NULL
      AND p.lng IS NOT NULL
      AND (p_filters->>'state' IS NULL OR p.state = p_filters->>'state')
      AND (p_filters->>'municipality' IS NULL OR p.municipality = p_filters->>'municipality')
      AND (p_filters->>'listingType' IS NULL OR p.listing_type = p_filters->>'listingType')
      AND (p_filters->>'propertyType' IS NULL OR p.type::text = p_filters->>'propertyType')
      AND (p_filters->>'minPrice' IS NULL OR p.price >= (p_filters->>'minPrice')::numeric)
      AND (p_filters->>'maxPrice' IS NULL OR p.price <= (p_filters->>'maxPrice')::numeric)
      AND (p_filters->>'minBedrooms' IS NULL OR p.bedrooms >= (p_filters->>'minBedrooms')::integer)
      AND (p_filters->>'minBathrooms' IS NULL OR p.bathrooms >= (p_filters->>'minBathrooms')::integer)
    AND NOT EXISTS (
      SELECT 1 FROM (
        SELECT FLOOR(p2.lat * 1000) AS lat_floor, FLOOR(p2.lng * 1000) AS lng_floor
        FROM properties p2
        WHERE p2.lat BETWEEN p_min_lat AND p_max_lat
          AND p2.lng BETWEEN p_min_lng AND p_max_lng
          AND p2.status::text = ANY(v_status)
          AND p2.lat IS NOT NULL
          AND p2.lng IS NOT NULL
          AND (p_filters->>'state' IS NULL OR p2.state = p_filters->>'state')
          AND (p_filters->>'municipality' IS NULL OR p2.municipality = p_filters->>'municipality')
          AND (p_filters->>'listingType' IS NULL OR p2.listing_type = p_filters->>'listingType')
          AND (p_filters->>'propertyType' IS NULL OR p2.type::text = p_filters->>'propertyType')
          AND (p_filters->>'minPrice' IS NULL OR p2.price >= (p_filters->>'minPrice')::numeric)
          AND (p_filters->>'maxPrice' IS NULL OR p2.price <= (p_filters->>'maxPrice')::numeric)
          AND (p_filters->>'minBedrooms' IS NULL OR p2.bedrooms >= (p_filters->>'minBedrooms')::integer)
          AND (p_filters->>'minBathrooms' IS NULL OR p2.bathrooms >= (p_filters->>'minBathrooms')::integer)
        GROUP BY lat_floor, lng_floor
        HAVING COUNT(*) >= v_cluster_threshold
      ) clustered_coords
      WHERE clustered_coords.lat_floor = FLOOR(p.lat * 1000)
        AND clustered_coords.lng_floor = FLOOR(p.lng * 1000)
    )
    LIMIT 1000
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'title', title,
      'lat', lat,
      'lng', lng,
      'price', price,
      'currency', currency,
      'type', type,
      'bedrooms', bedrooms,
      'bathrooms', bathrooms,
      'mainImage', main_image
    )
  ), '[]'::jsonb)
  INTO v_properties
  FROM individual_properties;

  -- 💾 Guardar en cache
  INSERT INTO property_tiles_cache (
    tile_key,
    filters_hash,
    zoom,
    bounds,
    clusters,
    properties,
    property_count,
    expires_at,
    last_accessed_at,
    access_count
  )
  VALUES (
    v_tile_key,
    v_filters_hash,
    p_zoom,
    ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326),
    v_clusters,
    v_properties,
    jsonb_array_length(v_properties),
    NOW() + INTERVAL '5 minutes',
    NOW(),
    1
  )
  ON CONFLICT ON CONSTRAINT property_tiles_cache_tile_key_filters_hash_key
  DO UPDATE SET
    clusters = EXCLUDED.clusters,
    properties = EXCLUDED.properties,
    property_count = EXCLUDED.property_count,
    expires_at = EXCLUDED.expires_at,
    last_accessed_at = NOW(),
    access_count = property_tiles_cache.access_count + 1;

  RETURN jsonb_build_object(
    'clusters', v_clusters,
    'properties', v_properties
  );
END;
$$;