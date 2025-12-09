-- ============================================================================
-- MEJORA DE MAPAS ESTILO ZILLOW
-- ============================================================================
-- Cambios:
-- 1. Zoom threshold para propiedades individuales: 13 (antes 10)
-- 2. Límite de 500 propiedades individuales con ORDER BY destacadas primero
-- 3. Clustering adaptativo mejorado según nivel de zoom
-- 4. Grid size más preciso para mejor agrupación visual
-- 5. Retorna has_more cuando hay más propiedades del límite
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_map_tiles(double precision, double precision, double precision, double precision, integer, jsonb);

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
SET search_path TO 'public'
AS $function$
DECLARE
  v_tile_key text;
  v_filters_hash text;
  v_cached_result jsonb;
  v_result jsonb;
  v_properties_result jsonb;
  v_clusters_result jsonb;
  -- CAMBIO: Umbral de zoom para mostrar propiedades individuales (antes era 10)
  -- Zillow usa ~14, usamos 13 para balance entre rendimiento y UX
  v_cluster_zoom integer := 13;
  v_cluster_grid_size double precision;
  v_property_type text[];
  v_min_price numeric;
  v_max_price numeric;
  v_bedrooms integer;
  v_bathrooms integer;
  v_listing_type text;
  v_estado text;
  v_municipio text;
  v_colonia text;
  -- NUEVO: Variables para límites y conteo
  v_max_properties integer := 500;
  v_total_count integer;
  v_has_more boolean := false;
BEGIN
  v_tile_key := format('z%s_x%s_y%s', p_zoom, floor((p_min_lng + 180) / 360 * power(2, p_zoom)), floor((1 - ln(tan(radians(p_max_lat)) + 1 / cos(radians(p_max_lat))) / pi()) / 2 * power(2, p_zoom)));
  v_filters_hash := md5(p_filters::text);

  -- Intentar obtener resultado cacheado
  SELECT jsonb_build_object('properties', properties, 'clusters', clusters)
  INTO v_cached_result
  FROM property_tiles_cache
  WHERE tile_key = v_tile_key
    AND filters_hash = v_filters_hash
    AND expires_at > now()
  LIMIT 1;

  IF v_cached_result IS NOT NULL THEN
    RETURN v_cached_result;
  END IF;

  -- MEJORADO: Grid size adaptativo según zoom
  -- Zoom 3-5:   ~50km (0.5 grados) - Vista país
  -- Zoom 6-8:   ~20km (0.2 grados) - Vista región
  -- Zoom 9-10:  ~5km  (0.05 grados) - Vista estado
  -- Zoom 11-12: ~2km  (0.02 grados) - Vista ciudad
  v_cluster_grid_size := CASE
    WHEN p_zoom <= 5 THEN 0.5
    WHEN p_zoom <= 8 THEN 0.2
    WHEN p_zoom <= 10 THEN 0.05
    WHEN p_zoom <= 12 THEN 0.02
    ELSE 0.01
  END;

  -- Extraer filtros del JSONB
  IF p_filters ? 'propertyType' AND jsonb_array_length(p_filters->'propertyType') > 0 THEN
    SELECT array_agg(value::text)
    INTO v_property_type
    FROM jsonb_array_elements_text(p_filters->'propertyType');
  END IF;

  IF p_filters ? 'minPrice' THEN
    v_min_price := (p_filters->>'minPrice')::numeric;
  END IF;

  IF p_filters ? 'maxPrice' THEN
    v_max_price := (p_filters->>'maxPrice')::numeric;
  END IF;

  IF p_filters ? 'bedrooms' THEN
    v_bedrooms := (p_filters->>'bedrooms')::integer;
  END IF;

  IF p_filters ? 'bathrooms' THEN
    v_bathrooms := (p_filters->>'bathrooms')::integer;
  END IF;

  IF p_filters ? 'listingType' THEN
    v_listing_type := p_filters->>'listingType';
  END IF;

  IF p_filters ? 'estado' THEN
    v_estado := p_filters->>'estado';
  END IF;

  IF p_filters ? 'municipio' THEN
    v_municipio := p_filters->>'municipio';
  END IF;

  IF p_filters ? 'colonia' THEN
    v_colonia := p_filters->>'colonia';
  END IF;

  IF p_zoom >= v_cluster_zoom THEN
    -- ===================================================================
    -- ZOOM ALTO (>= 13): Propiedades individuales con límite
    -- ===================================================================

    -- Primero contar cuántas propiedades hay
    SELECT COUNT(*)
    INTO v_total_count
    FROM properties p
    WHERE p.lat IS NOT NULL
      AND p.lng IS NOT NULL
      AND p.lat BETWEEN p_min_lat AND p_max_lat
      AND p.lng BETWEEN p_min_lng AND p_max_lng
      AND p.status = 'activa'::property_status
      AND (v_property_type IS NULL OR p.type::text = ANY(v_property_type))
      AND (v_min_price IS NULL OR p.price >= v_min_price)
      AND (v_max_price IS NULL OR p.price <= v_max_price)
      AND (v_bedrooms IS NULL OR p.bedrooms >= v_bedrooms)
      AND (v_bathrooms IS NULL OR p.bathrooms >= v_bathrooms)
      AND (v_listing_type IS NULL OR v_listing_type = '' OR
           p.listing_type = v_listing_type OR
           (v_listing_type = 'venta' AND p.for_sale = true) OR
           (v_listing_type = 'renta' AND p.for_rent = true))
      AND (v_estado IS NULL OR v_estado = '' OR p.state ILIKE '%' || v_estado || '%')
      AND (v_municipio IS NULL OR v_municipio = '' OR p.municipality ILIKE '%' || v_municipio || '%')
      AND (v_colonia IS NULL OR v_colonia = '' OR p.colonia ILIKE '%' || v_colonia || '%' OR p.address ILIKE '%' || v_colonia || '%');

    -- Determinar si hay más resultados del límite
    v_has_more := v_total_count > v_max_properties;

    -- Obtener propiedades con límite y ordenadas (destacadas primero, luego por precio)
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'lat', p.lat,
      'lng', p.lng,
      'price', p.price,
      'currency', p.currency,
      'title', p.title,
      'type', p.type,
      'listing_type', p.listing_type,
      'bedrooms', p.bedrooms,
      'bathrooms', p.bathrooms,
      'sqft', p.sqft,
      'municipality', p.municipality,
      'state', p.state,
      'image_url', (SELECT url FROM unnest(p.images) AS img LIMIT 1),
      'is_featured', p.is_featured,
      'created_at', p.created_at
    ) ORDER BY p.is_featured DESC, p.price DESC), '[]'::jsonb)
    INTO v_properties_result
    FROM (
      SELECT *
      FROM properties p
      WHERE p.lat IS NOT NULL
        AND p.lng IS NOT NULL
        AND p.lat BETWEEN p_min_lat AND p_max_lat
        AND p.lng BETWEEN p_min_lng AND p_max_lng
        AND p.status = 'activa'::property_status
        AND (v_property_type IS NULL OR p.type::text = ANY(v_property_type))
        AND (v_min_price IS NULL OR p.price >= v_min_price)
        AND (v_max_price IS NULL OR p.price <= v_max_price)
        AND (v_bedrooms IS NULL OR p.bedrooms >= v_bedrooms)
        AND (v_bathrooms IS NULL OR p.bathrooms >= v_bathrooms)
        AND (v_listing_type IS NULL OR v_listing_type = '' OR
             p.listing_type = v_listing_type OR
             (v_listing_type = 'venta' AND p.for_sale = true) OR
             (v_listing_type = 'renta' AND p.for_rent = true))
        AND (v_estado IS NULL OR v_estado = '' OR p.state ILIKE '%' || v_estado || '%')
        AND (v_municipio IS NULL OR v_municipio = '' OR p.municipality ILIKE '%' || v_municipio || '%')
        AND (v_colonia IS NULL OR v_colonia = '' OR p.colonia ILIKE '%' || v_colonia || '%' OR p.address ILIKE '%' || v_colonia || '%')
      ORDER BY p.is_featured DESC, p.price DESC
      LIMIT v_max_properties
    ) p;

    v_result := jsonb_build_object(
      'properties', v_properties_result,
      'clusters', '[]'::jsonb,
      'total_count', v_total_count,
      'has_more', v_has_more
    );
  ELSE
    -- ===================================================================
    -- ZOOM BAJO (< 13): Clusters adaptativos
    -- ===================================================================
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'lat', cluster_lat,
      'lng', cluster_lng,
      'count', property_count,
      'avg_price', avg_price
    )), '[]'::jsonb)
    INTO v_clusters_result
    FROM (
      SELECT
        ROUND((p.lat / v_cluster_grid_size)::numeric, 0) * v_cluster_grid_size AS cluster_lat,
        ROUND((p.lng / v_cluster_grid_size)::numeric, 0) * v_cluster_grid_size AS cluster_lng,
        COUNT(*)::integer AS property_count,
        ROUND(AVG(p.price)::numeric, 0) AS avg_price
      FROM properties p
      WHERE p.lat IS NOT NULL
        AND p.lng IS NOT NULL
        AND p.lat BETWEEN p_min_lat AND p_max_lat
        AND p.lng BETWEEN p_min_lng AND p_max_lng
        AND p.status = 'activa'::property_status
        AND (v_property_type IS NULL OR p.type::text = ANY(v_property_type))
        AND (v_min_price IS NULL OR p.price >= v_min_price)
        AND (v_max_price IS NULL OR p.price <= v_max_price)
        AND (v_bedrooms IS NULL OR p.bedrooms >= v_bedrooms)
        AND (v_bathrooms IS NULL OR p.bathrooms >= v_bathrooms)
        AND (v_listing_type IS NULL OR v_listing_type = '' OR
             p.listing_type = v_listing_type OR
             (v_listing_type = 'venta' AND p.for_sale = true) OR
             (v_listing_type = 'renta' AND p.for_rent = true))
        AND (v_estado IS NULL OR v_estado = '' OR p.state ILIKE '%' || v_estado || '%')
        AND (v_municipio IS NULL OR v_municipio = '' OR p.municipality ILIKE '%' || v_municipio || '%')
        AND (v_colonia IS NULL OR v_colonia = '' OR p.colonia ILIKE '%' || v_colonia || '%' OR p.address ILIKE '%' || v_colonia || '%')
      GROUP BY cluster_lat, cluster_lng
      HAVING COUNT(*) > 0
    ) subq;

    -- Calcular total de propiedades en clusters
    SELECT COALESCE(SUM((cluster->>'count')::integer), 0)
    INTO v_total_count
    FROM jsonb_array_elements(v_clusters_result) AS cluster;

    v_result := jsonb_build_object(
      'properties', '[]'::jsonb,
      'clusters', v_clusters_result,
      'total_count', v_total_count,
      'has_more', false
    );
  END IF;

  -- Guardar en caché (5 minutos)
  INSERT INTO property_tiles_cache (tile_key, filters_hash, zoom, bounds, properties, clusters, property_count)
  VALUES (
    v_tile_key,
    v_filters_hash,
    p_zoom,
    ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326),
    v_result->'properties',
    v_result->'clusters',
    v_total_count
  )
  ON CONFLICT (tile_key, filters_hash)
  DO UPDATE SET
    properties = EXCLUDED.properties,
    clusters = EXCLUDED.clusters,
    property_count = EXCLUDED.property_count,
    expires_at = now() + interval '5 minutes',
    last_accessed_at = now(),
    access_count = property_tiles_cache.access_count + 1;

  RETURN v_result;
END;
$function$;

-- Limpiar caché para regenerar con nuevos parámetros
TRUNCATE TABLE property_tiles_cache;

-- Comentario de la función
COMMENT ON FUNCTION public.get_map_tiles IS 'Función RPC para mapas estilo Zillow.
- Zoom >= 13: propiedades individuales (max 500, ordenadas por destacadas/precio)
- Zoom < 13: clusters adaptativos
- Retorna total_count y has_more para UX
Actualizado: 2025-12-09';
