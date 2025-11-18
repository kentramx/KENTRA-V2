-- ============================================================================
-- Optimización del Mapa Estilo Zillow
-- ============================================================================
-- Reduce límites para mejorar rendimiento manteniendo experiencia visual rica
-- - Backend: 5000 → 2000 propiedades por viewport (-60% payload)
-- - Frontend maneja el recorte a 1000 marcadores (-80% DOM)
-- - Mejora significativa en memoria y fluidez sin perder funcionalidad
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_map_tiles(
  p_min_lng double precision,
  p_min_lat double precision,
  p_max_lng double precision,
  p_max_lat double precision,
  p_zoom integer,
  p_filters jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_status text[] := COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_filters->'status')), ARRAY['activa']);
  v_state text := NULLIF(p_filters->>'state', '');
  v_municipality text := NULLIF(p_filters->>'municipality', '');
  v_listing_type text := NULLIF(p_filters->>'listingType', '');
  v_property_type text := NULLIF(p_filters->>'propertyType', '');
  v_min_price numeric := (p_filters->>'minPrice')::numeric;
  v_max_price numeric := (p_filters->>'maxPrice')::numeric;
  v_min_bedrooms int := (p_filters->>'minBedrooms')::int;
  v_min_bathrooms int := (p_filters->>'minBathrooms')::int;
  v_max_properties int := 2000;  -- ✅ OPTIMIZADO: De 5000 a 2000 (estilo Zillow, suficiente para cualquier ciudad)
  
  v_cache_key text;
  v_cache_hit boolean := false;
  v_cached_data jsonb;
  v_filters_hash text;
  v_tile_key text;
BEGIN
  -- Generar hash único de filtros (para cache)
  v_filters_hash := md5(
    COALESCE(array_to_string(v_status, ','), '') ||
    COALESCE(v_state, '') ||
    COALESCE(v_municipality, '') ||
    COALESCE(v_listing_type, '') ||
    COALESCE(v_property_type, '') ||
    COALESCE(v_min_price::text, '') ||
    COALESCE(v_max_price::text, '') ||
    COALESCE(v_min_bedrooms::text, '') ||
    COALESCE(v_min_bathrooms::text, '')
  );

  -- Generar tile_key único para este viewport + zoom
  v_tile_key := md5(
    p_min_lng::text || ',' || p_min_lat::text || ',' ||
    p_max_lng::text || ',' || p_max_lat::text || ',' ||
    p_zoom::text
  );

  -- =====================================================================
  -- 🔥 CACHE LOOKUP con TTL de 5 minutos
  -- =====================================================================
  SELECT clusters, properties
  INTO v_cached_data
  FROM property_tiles_cache
  WHERE tile_key = v_tile_key
    AND filters_hash = v_filters_hash
    AND zoom = p_zoom
    AND expires_at > now()
  LIMIT 1;

  IF v_cached_data IS NOT NULL THEN
    -- Cache hit: actualizar access_count y last_accessed_at
    UPDATE property_tiles_cache
    SET 
      access_count = access_count + 1,
      last_accessed_at = now()
    WHERE tile_key = v_tile_key
      AND filters_hash = v_filters_hash
      AND zoom = p_zoom;

    RETURN v_cached_data;
  END IF;

  -- =====================================================================
  -- CACHE MISS: Calcular datos desde cero
  -- =====================================================================
  
  -- Modo clustering para zoom bajo (< 11)
  IF p_zoom < 11 THEN
    -- Devolver clusters pre-agregados
    v_result := (
      SELECT jsonb_build_object(
        'clusters', COALESCE(jsonb_agg(cluster_data), '[]'::jsonb),
        'properties', '[]'::jsonb
      )
      FROM (
        SELECT jsonb_build_object(
          'lat', avg_lat,
          'lng', avg_lng,
          'count', property_count,
          'avgPrice', avg_price
        ) as cluster_data
        FROM (
          SELECT
            AVG(p.lat) as avg_lat,
            AVG(p.lng) as avg_lng,
            COUNT(*) as property_count,
            AVG(CASE 
              WHEN p.listing_type = 'sale' OR p.for_sale THEN COALESCE(p.sale_price, p.price)
              WHEN p.listing_type = 'rent' OR p.for_rent THEN COALESCE(p.rent_price, p.price)
              ELSE p.price
            END) as avg_price,
            -- Grid clustering (ajustar la precisión según zoom)
            FLOOR(p.lat / (0.5 / POWER(2, p_zoom))) as lat_grid,
            FLOOR(p.lng / (0.5 / POWER(2, p_zoom))) as lng_grid
          FROM public.properties p
          WHERE p.lat IS NOT NULL 
            AND p.lng IS NOT NULL
            AND p.lat BETWEEN p_min_lat AND p_max_lat
            AND p.lng BETWEEN p_min_lng AND p_max_lng
            AND p.status = ANY(v_status)
            AND (v_state IS NULL OR p.state = v_state)
            AND (v_municipality IS NULL OR p.municipality = v_municipality)
            AND (v_listing_type IS NULL OR 
                 (v_listing_type = 'sale' AND p.for_sale) OR
                 (v_listing_type = 'rent' AND p.for_rent))
            AND (v_property_type IS NULL OR p.type::text = v_property_type)
            AND (v_min_price IS NULL OR 
                 (CASE 
                   WHEN v_listing_type = 'sale' THEN COALESCE(p.sale_price, p.price)
                   WHEN v_listing_type = 'rent' THEN COALESCE(p.rent_price, p.price)
                   ELSE p.price
                 END) >= v_min_price)
            AND (v_max_price IS NULL OR 
                 (CASE 
                   WHEN v_listing_type = 'sale' THEN COALESCE(p.sale_price, p.price)
                   WHEN v_listing_type = 'rent' THEN COALESCE(p.rent_price, p.price)
                   ELSE p.price
                 END) <= v_max_price)
            AND (v_min_bedrooms IS NULL OR p.bedrooms >= v_min_bedrooms)
            AND (v_min_bathrooms IS NULL OR p.bathrooms >= v_min_bathrooms)
          GROUP BY lat_grid, lng_grid
          HAVING COUNT(*) >= 1
        ) clusters
      ) clusters_result
    );
  ELSE
    -- Modo propiedades individuales para zoom alto (>= 11)
    v_result := (
      SELECT jsonb_build_object(
        'clusters', '[]'::jsonb,
        'properties', COALESCE(jsonb_agg(property_data), '[]'::jsonb)
      )
      FROM (
        SELECT jsonb_build_object(
          'id', p.id,
          'lat', p.lat,
          'lng', p.lng,
          'price', CASE 
            WHEN p.listing_type = 'sale' OR p.for_sale THEN COALESCE(p.sale_price, p.price)
            WHEN p.listing_type = 'rent' OR p.for_rent THEN COALESCE(p.rent_price, p.price)
            ELSE p.price
          END,
          'currency', p.currency,
          'title', p.title,
          'type', p.type,
          'listingType', p.listing_type,
          'bedrooms', p.bedrooms,
          'bathrooms', p.bathrooms
        ) as property_data
        FROM public.properties p
        WHERE p.lat IS NOT NULL 
          AND p.lng IS NOT NULL
          AND p.lat BETWEEN p_min_lat AND p_max_lat
          AND p.lng BETWEEN p_min_lng AND p_max_lng
          AND p.status = ANY(v_status)
          AND (v_state IS NULL OR p.state = v_state)
          AND (v_municipality IS NULL OR p.municipality = v_municipality)
          AND (v_listing_type IS NULL OR 
               (v_listing_type = 'sale' AND p.for_sale) OR
               (v_listing_type = 'rent' AND p.for_rent))
          AND (v_property_type IS NULL OR p.type::text = v_property_type)
          AND (v_min_price IS NULL OR 
               (CASE 
                 WHEN v_listing_type = 'sale' THEN COALESCE(p.sale_price, p.price)
                 WHEN v_listing_type = 'rent' THEN COALESCE(p.rent_price, p.price)
                 ELSE p.price
               END) >= v_min_price)
          AND (v_max_price IS NULL OR 
               (CASE 
                 WHEN v_listing_type = 'sale' THEN COALESCE(p.sale_price, p.price)
                 WHEN v_listing_type = 'rent' THEN COALESCE(p.rent_price, p.price)
                 ELSE p.price
               END) <= v_max_price)
          AND (v_min_bedrooms IS NULL OR p.bedrooms >= v_min_bedrooms)
          AND (v_min_bathrooms IS NULL OR p.bathrooms >= v_min_bathrooms)
        ORDER BY p.created_at DESC
        LIMIT v_max_properties
      ) properties_result
    );
  END IF;

  -- =====================================================================
  -- 🔥 GUARDAR EN CACHE con TTL de 5 minutos
  -- =====================================================================
  INSERT INTO property_tiles_cache (
    tile_key,
    filters_hash,
    zoom,
    bounds,
    clusters,
    properties,
    property_count,
    expires_at
  )
  VALUES (
    v_tile_key,
    v_filters_hash,
    p_zoom,
    ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326),
    v_result->'clusters',
    v_result->'properties',
    (
      CASE 
        WHEN jsonb_array_length(v_result->'properties') > 0 
        THEN jsonb_array_length(v_result->'properties')
        ELSE (
          SELECT COALESCE(SUM((cluster->>'count')::int), 0)::int
          FROM jsonb_array_elements(v_result->'clusters') as cluster
        )
      END
    ),
    now() + interval '5 minutes'
  )
  ON CONFLICT (tile_key, filters_hash, zoom)
  DO UPDATE SET
    clusters = EXCLUDED.clusters,
    properties = EXCLUDED.properties,
    property_count = EXCLUDED.property_count,
    expires_at = EXCLUDED.expires_at,
    last_accessed_at = now(),
    access_count = property_tiles_cache.access_count + 1;

  RETURN v_result;
END;
$$;