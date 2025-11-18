-- =====================================================
-- Migration: Fix get_map_tiles function overloading
-- =====================================================
-- Elimina TODAS las versiones duplicadas de get_map_tiles
-- y crea UNA SOLA versión definitiva para resolver PGRST203

-- =====================================================
-- PASO 1: Eliminar TODAS las versiones posibles
-- =====================================================

-- Versión con DECIMAL (versión antigua)
DROP FUNCTION IF EXISTS public.get_map_tiles(
  DECIMAL, DECIMAL, DECIMAL, DECIMAL, 
  INTEGER, TEXT, TEXT, DECIMAL, DECIMAL, 
  INTEGER, INTEGER, TEXT, TEXT
) CASCADE;

-- Versión con double precision y parámetros individuales
DROP FUNCTION IF EXISTS public.get_map_tiles(
  double precision, double precision, 
  double precision, double precision, 
  integer, text, text, double precision, double precision,
  integer, integer, text, text
) CASCADE;

-- Versión con double precision y JSONB
DROP FUNCTION IF EXISTS public.get_map_tiles(
  double precision, double precision, 
  double precision, double precision, 
  integer, jsonb
) CASCADE;

-- Versión con numeric
DROP FUNCTION IF EXISTS public.get_map_tiles(
  numeric, numeric, numeric, numeric, 
  integer, jsonb
) CASCADE;

-- Cualquier otra versión restante
DROP FUNCTION IF EXISTS public.get_map_tiles CASCADE;

-- =====================================================
-- PASO 2: Crear UNA SOLA versión definitiva
-- =====================================================

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
  v_tile_key text;
  v_filters_hash text;
  v_cached_data jsonb;
  v_result jsonb;
  v_properties jsonb := '[]'::jsonb;
  v_clusters jsonb := '[]'::jsonb;
  v_property_type text;
  v_listing_type text;
  v_state text;
  v_municipality text;
  v_min_price numeric;
  v_max_price numeric;
  v_bedrooms integer;
  v_bathrooms integer;
  v_status text[];
  v_property_count integer := 0;
BEGIN
  -- =====================================================
  -- EXTRAER FILTROS DEL JSONB
  -- =====================================================
  v_property_type := p_filters->>'propertyType';
  v_listing_type := p_filters->>'listingType';
  v_state := p_filters->>'state';
  v_municipality := p_filters->>'municipality';
  v_min_price := (p_filters->>'minPrice')::numeric;
  v_max_price := (p_filters->>'maxPrice')::numeric;
  v_bedrooms := (p_filters->>'bedrooms')::integer;
  v_bathrooms := (p_filters->>'bathrooms')::integer;
  
  -- Status siempre incluye 'approved'
  v_status := ARRAY['approved'];

  -- =====================================================
  -- GENERAR CACHE KEY
  -- =====================================================
  v_tile_key := format('tile_%s_%s_%s_%s_%s',
    p_zoom,
    round(p_min_lng::numeric, 4),
    round(p_min_lat::numeric, 4),
    round(p_max_lng::numeric, 4),
    round(p_max_lat::numeric, 4)
  );
  
  v_filters_hash := md5(p_filters::text);

  -- =====================================================
  -- INTENTAR RECUPERAR DESDE CACHE
  -- =====================================================
  SELECT properties, clusters, property_count
  INTO v_properties, v_clusters, v_property_count
  FROM public.property_tiles_cache
  WHERE tile_key = v_tile_key
    AND filters_hash = v_filters_hash
    AND expires_at > now()
  LIMIT 1;

  -- Si hay cache válido, retornar inmediatamente
  IF v_properties IS NOT NULL THEN
    RAISE NOTICE '[get_map_tiles] ✅ CACHE HIT: tile_key=%, count=%', v_tile_key, v_property_count;
    
    UPDATE public.property_tiles_cache
    SET access_count = access_count + 1,
        last_accessed_at = now()
    WHERE tile_key = v_tile_key
      AND filters_hash = v_filters_hash;

    RETURN jsonb_build_object(
      'properties', v_properties,
      'clusters', v_clusters,
      'propertyCount', v_property_count,
      'fromCache', true
    );
  END IF;

  RAISE NOTICE '[get_map_tiles] ❌ CACHE MISS: tile_key=%, filters=%', v_tile_key, p_filters;

  -- =====================================================
  -- CLUSTERING: Zoom bajo (≤12)
  -- =====================================================
  IF p_zoom <= 12 THEN
    RAISE NOTICE '[get_map_tiles] 🔵 Modo CLUSTERING (zoom=%)', p_zoom;

    WITH filtered_properties AS (
      SELECT 
        p.id,
        p.lat,
        p.lng,
        p.price,
        p.type,
        p.listing_type
      FROM public.properties p
      WHERE p.lat IS NOT NULL
        AND p.lng IS NOT NULL
        AND p.lat BETWEEN p_min_lat AND p_max_lat
        AND p.lng BETWEEN p_min_lng AND p_max_lng
        AND p.status::text = ANY(v_status)
        AND (v_property_type IS NULL OR p.type::text = v_property_type)
        AND (v_listing_type IS NULL OR 
             (v_listing_type = 'venta' AND p.for_sale = true) OR
             (v_listing_type = 'renta' AND p.for_rent = true))
        AND (v_state IS NULL OR p.state = v_state)
        AND (v_municipality IS NULL OR p.municipality = v_municipality)
        AND (v_min_price IS NULL OR p.price >= v_min_price)
        AND (v_max_price IS NULL OR p.price <= v_max_price)
        AND (v_bedrooms IS NULL OR p.bedrooms >= v_bedrooms)
        AND (v_bathrooms IS NULL OR p.bathrooms >= v_bathrooms)
    ),
    grid_clusters AS (
      SELECT
        floor(lat * 20) / 20 AS grid_lat,
        floor(lng * 20) / 20 AS grid_lng,
        count(*)::integer AS count,
        avg(lat) AS center_lat,
        avg(lng) AS center_lng,
        min(price) AS min_price,
        max(price) AS max_price,
        avg(price) AS avg_price
      FROM filtered_properties
      GROUP BY grid_lat, grid_lng
      HAVING count(*) >= 3
    )
    SELECT 
      jsonb_agg(
        jsonb_build_object(
          'lat', center_lat,
          'lng', center_lng,
          'count', count,
          'minPrice', min_price,
          'maxPrice', max_price,
          'avgPrice', round(avg_price)
        )
      )
    INTO v_clusters
    FROM grid_clusters;

    v_clusters := COALESCE(v_clusters, '[]'::jsonb);
    v_property_count := (SELECT count(*) FROM filtered_properties)::integer;

    RAISE NOTICE '[get_map_tiles] 📊 Clusters generados: %', jsonb_array_length(v_clusters);

  -- =====================================================
  -- PROPIEDADES INDIVIDUALES: Zoom alto (>12)
  -- =====================================================
  ELSE
    RAISE NOTICE '[get_map_tiles] 📍 Modo PROPIEDADES (zoom=%)', p_zoom;

    WITH filtered_properties AS (
      SELECT 
        p.id,
        p.title,
        p.price,
        p.currency,
        p.lat,
        p.lng,
        p.type,
        p.listing_type,
        p.bedrooms,
        p.bathrooms,
        p.sqft,
        p.state,
        p.municipality,
        (SELECT i.url FROM public.images i WHERE i.property_id = p.id ORDER BY i.position LIMIT 1) AS image_url,
        EXISTS(SELECT 1 FROM public.featured_properties fp WHERE fp.property_id = p.id AND fp.end_date > now()) AS is_featured
      FROM public.properties p
      WHERE p.lat IS NOT NULL
        AND p.lng IS NOT NULL
        AND p.lat BETWEEN p_min_lat AND p_max_lat
        AND p.lng BETWEEN p_min_lng AND p_max_lng
        AND p.status::text = ANY(v_status)
        AND (v_property_type IS NULL OR p.type::text = v_property_type)
        AND (v_listing_type IS NULL OR 
             (v_listing_type = 'venta' AND p.for_sale = true) OR
             (v_listing_type = 'renta' AND p.for_rent = true))
        AND (v_state IS NULL OR p.state = v_state)
        AND (v_municipality IS NULL OR p.municipality = v_municipality)
        AND (v_min_price IS NULL OR p.price >= v_min_price)
        AND (v_max_price IS NULL OR p.price <= v_max_price)
        AND (v_bedrooms IS NULL OR p.bedrooms >= v_bedrooms)
        AND (v_bathrooms IS NULL OR p.bathrooms >= v_bathrooms)
      ORDER BY is_featured DESC, p.created_at DESC
      LIMIT 2000
    )
    SELECT 
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'title', title,
          'price', price,
          'currency', currency,
          'lat', lat,
          'lng', lng,
          'type', type,
          'listingType', listing_type,
          'bedrooms', bedrooms,
          'bathrooms', bathrooms,
          'sqft', sqft,
          'state', state,
          'municipality', municipality,
          'imageUrl', image_url,
          'isFeatured', is_featured
        )
      ),
      count(*)::integer
    INTO v_properties, v_property_count
    FROM filtered_properties;

    v_properties := COALESCE(v_properties, '[]'::jsonb);
    v_property_count := COALESCE(v_property_count, 0);

    RAISE NOTICE '[get_map_tiles] 📍 Propiedades encontradas: %', v_property_count;
  END IF;

  -- =====================================================
  -- GUARDAR EN CACHE (TTL = 5 minutos)
  -- =====================================================
  INSERT INTO public.property_tiles_cache (
    tile_key,
    filters_hash,
    zoom,
    bounds,
    properties,
    clusters,
    property_count,
    expires_at
  ) VALUES (
    v_tile_key,
    v_filters_hash,
    p_zoom,
    ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326),
    v_properties,
    v_clusters,
    v_property_count,
    now() + interval '5 minutes'
  )
  ON CONFLICT (tile_key, filters_hash)
  DO UPDATE SET
    properties = EXCLUDED.properties,
    clusters = EXCLUDED.clusters,
    property_count = EXCLUDED.property_count,
    expires_at = EXCLUDED.expires_at,
    last_accessed_at = now(),
    access_count = property_tiles_cache.access_count + 1;

  RAISE NOTICE '[get_map_tiles] 💾 Cache guardado: tile_key=%, count=%', v_tile_key, v_property_count;

  -- =====================================================
  -- RETORNAR RESULTADO
  -- =====================================================
  RETURN jsonb_build_object(
    'properties', v_properties,
    'clusters', v_clusters,
    'propertyCount', v_property_count,
    'fromCache', false
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[get_map_tiles] ⚠️ ERROR: %', SQLERRM;
    RETURN jsonb_build_object(
      'properties', '[]'::jsonb,
      'clusters', '[]'::jsonb,
      'propertyCount', 0,
      'error', SQLERRM
    );
END;
$$;

-- =====================================================
-- COMENTARIOS Y SEGURIDAD
-- =====================================================

COMMENT ON FUNCTION public.get_map_tiles IS 'Función definitiva y única para obtener tiles de mapa con caché TTL de 5 minutos. Soporta clustering en zoom bajo y propiedades individuales en zoom alto. Parámetros: (min_lng, min_lat, max_lng, max_lat, zoom, filters_jsonb)';

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.get_map_tiles TO anon;
GRANT EXECUTE ON FUNCTION public.get_map_tiles TO authenticated;