-- Corregir función get_map_tiles para que clusters muestren el conteo total del área
-- sin aplicar filtros de tipo de propiedad, precio, etc. Solo status='activa' y coordenadas.

DROP FUNCTION IF EXISTS get_map_tiles(numeric, numeric, numeric, numeric, integer, jsonb);

CREATE OR REPLACE FUNCTION get_map_tiles(
  p_min_lng numeric,
  p_min_lat numeric,
  p_max_lng numeric,
  p_max_lat numeric,
  p_zoom integer,
  p_filters jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tile_key text;
  v_filters_hash text;
  v_cached_tile record;
  v_result jsonb;
  v_clusters jsonb;
  v_properties jsonb;
BEGIN
  -- 1. Generar tile_key (basado en bounds + zoom)
  v_tile_key := format('tile_%s_%s_%s_%s_z%s', 
    p_min_lng::text, p_min_lat::text, 
    p_max_lng::text, p_max_lat::text, 
    p_zoom::text
  );
  
  -- 2. Generar filters_hash
  v_filters_hash := generate_filters_hash(p_filters);
  
  -- 3. Buscar en cache (tile válido no expirado)
  SELECT * INTO v_cached_tile
  FROM property_tiles_cache
  WHERE tile_key = v_tile_key
    AND filters_hash = v_filters_hash
    AND expires_at > now()
  LIMIT 1;
  
  -- 4. Si existe en cache, retornar inmediatamente
  IF FOUND THEN
    -- Actualizar access_count y last_accessed_at
    UPDATE property_tiles_cache
    SET access_count = access_count + 1,
        last_accessed_at = now()
    WHERE tile_key = v_tile_key
      AND filters_hash = v_filters_hash;
    
    -- Retornar del cache
    IF v_cached_tile.clusters IS NOT NULL THEN
      RETURN jsonb_build_object('clusters', v_cached_tile.clusters);
    ELSE
      RETURN jsonb_build_object('properties', v_cached_tile.properties);
    END IF;
  END IF;
  
  -- 5. No existe en cache, calcular resultado
  -- Zoom bajo (<11): retornar clusters CON CONTEO TOTAL DEL ÁREA (sin filtros adicionales)
  IF p_zoom < 11 THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'lat', avg_lat,
        'lng', avg_lng,
        'count', property_count
      )
    ) INTO v_clusters
    FROM (
      SELECT 
        ROUND(AVG(p.lat)::numeric, 4) as avg_lat,
        ROUND(AVG(p.lng)::numeric, 4) as avg_lng,
        COUNT(*)::integer as property_count
      FROM properties p
      WHERE p.status = 'activa'
        AND p.lat IS NOT NULL 
        AND p.lng IS NOT NULL
        AND p.lat BETWEEN p_min_lat AND p_max_lat
        AND p.lng BETWEEN p_min_lng AND p_max_lng
        -- ✅ SIN FILTROS ADICIONALES AQUÍ: El count debe reflejar TODAS las propiedades del área
      GROUP BY 
        -- Cluster por grilla de 0.05 grados (~5km)
        FLOOR(p.lat / 0.05),
        FLOOR(p.lng / 0.05)
      HAVING COUNT(*) > 0
      LIMIT 100
    ) clustered;
    
    v_result := jsonb_build_object('clusters', COALESCE(v_clusters, '[]'::jsonb));
    
  -- Zoom alto (>=11): retornar propiedades individuales CON TODOS LOS FILTROS
  ELSE
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'title', p.title,
        'price', p.price,
        'lat', p.lat,
        'lng', p.lng,
        'property_type', p.type,
        'listing_type', p.listing_type,
        'bedrooms', p.bedrooms,
        'bathrooms', p.bathrooms,
        'parking', p.parking,
        'sqft', p.sqft,
        'municipality', p.municipality,
        'state', p.state,
        'image_url', (
          SELECT url FROM images 
          WHERE images.property_id = p.id 
          ORDER BY position ASC 
          LIMIT 1
        )
      )
    ) INTO v_properties
    FROM properties p
    WHERE p.status = 'activa'
      AND p.lat IS NOT NULL 
      AND p.lng IS NOT NULL
      AND p.lat BETWEEN p_min_lat AND p_max_lat
      AND p.lng BETWEEN p_min_lng AND p_max_lng
      -- ✅ AQUÍ SÍ SE APLICAN TODOS LOS FILTROS para propiedades individuales
      AND (p_filters->>'state' IS NULL OR p.state = p_filters->>'state')
      AND (p_filters->>'municipality' IS NULL OR p.municipality = p_filters->>'municipality')
      AND (p_filters->>'listingType' IS NULL OR p.listing_type = p_filters->>'listingType')
      AND (p_filters->>'propertyType' IS NULL OR p.type::text = p_filters->>'propertyType')
      AND (p_filters->>'minPrice' IS NULL OR p.price >= (p_filters->>'minPrice')::numeric)
      AND (p_filters->>'maxPrice' IS NULL OR p.price <= (p_filters->>'maxPrice')::numeric)
      AND (p_filters->>'minBedrooms' IS NULL OR p.bedrooms >= (p_filters->>'minBedrooms')::integer)
      AND (p_filters->>'minBathrooms' IS NULL OR p.bathrooms >= (p_filters->>'minBathrooms')::integer)
    LIMIT 1000;
    
    v_result := jsonb_build_object('properties', COALESCE(v_properties, '[]'::jsonb));
  END IF;
  
  -- 6. Guardar resultado en cache (TTL 5 minutos)
  INSERT INTO property_tiles_cache (
    tile_key,
    filters_hash,
    zoom,
    bounds,
    clusters,
    properties,
    property_count,
    expires_at,
    last_accessed_at
  ) VALUES (
    v_tile_key,
    v_filters_hash,
    p_zoom,
    ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326),
    CASE WHEN p_zoom < 11 THEN v_clusters ELSE NULL END,
    CASE WHEN p_zoom >= 11 THEN v_properties ELSE NULL END,
    CASE 
      WHEN p_zoom < 11 THEN jsonb_array_length(COALESCE(v_clusters, '[]'::jsonb))
      ELSE jsonb_array_length(COALESCE(v_properties, '[]'::jsonb))
    END,
    now() + interval '5 minutes',
    now()
  )
  ON CONFLICT (tile_key, filters_hash) 
  DO UPDATE SET
    clusters = EXCLUDED.clusters,
    properties = EXCLUDED.properties,
    property_count = EXCLUDED.property_count,
    expires_at = EXCLUDED.expires_at,
    last_accessed_at = EXCLUDED.last_accessed_at,
    access_count = property_tiles_cache.access_count + 1;
  
  RETURN v_result;
END;
$$;