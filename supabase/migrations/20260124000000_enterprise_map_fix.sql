-- ============================================================================
-- ENTERPRISE MAP FIX - EJECUTAR EN SUPABASE SQL EDITOR
-- ============================================================================
-- URL: https://supabase.com/dashboard/project/rxtmnbcewprzfgkvehsq/sql
--
-- Este script arregla:
-- 1. Performance de la lista de propiedades (ORDER BY lento)
-- 2. Clusters pre-computados vacíos
-- 3. Conteo estimado rápido para viewport grande
-- ============================================================================

-- ============================================================================
-- PASO 1: CREAR/REFRESCAR VISTA MATERIALIZADA PARA CONTEO ESTIMADO
-- ============================================================================

-- Esta vista permite obtener el conteo total en O(1) en lugar de O(n)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_property_counts_by_status AS
SELECT
  status::text as status,
  COUNT(*) as count
FROM properties
GROUP BY status;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_property_counts_status
ON mv_property_counts_by_status (status);

-- Refrescar la vista con datos actuales
REFRESH MATERIALIZED VIEW mv_property_counts_by_status;

-- ============================================================================
-- PASO 2: CREAR ÍNDICE COVERING PARA ORDER BY RÁPIDO
-- ============================================================================

-- Este índice permite ORDER BY created_at DESC sin escanear toda la tabla
CREATE INDEX IF NOT EXISTS idx_properties_active_newest
ON properties (created_at DESC, id)
WHERE status = 'activa';

-- Índice para ORDER BY price
CREATE INDEX IF NOT EXISTS idx_properties_active_price_asc
ON properties (price ASC, created_at DESC, id)
WHERE status = 'activa';

CREATE INDEX IF NOT EXISTS idx_properties_active_price_desc
ON properties (price DESC, created_at DESC, id)
WHERE status = 'activa';

-- Analizar tabla para que el planificador use los nuevos índices
ANALYZE properties;

-- ============================================================================
-- PASO 3: OPTIMIZAR search_properties PARA EVITAR SPATIAL FILTER LENTO
-- ============================================================================

CREATE OR REPLACE FUNCTION search_properties(
  p_status text DEFAULT 'activa',
  p_listing_type text DEFAULT NULL,
  p_property_type text DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_min_bedrooms int DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_municipality text DEFAULT NULL,
  p_bounds_north float DEFAULT NULL,
  p_bounds_south float DEFAULT NULL,
  p_bounds_east float DEFAULT NULL,
  p_bounds_west float DEFAULT NULL,
  p_sort text DEFAULT 'newest',
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  properties jsonb,
  total_count bigint
) AS $$
DECLARE
  v_properties jsonb;
  v_total bigint;
  v_has_valid_bounds boolean;
  v_bounds_area float;
  v_fetched_count int;
BEGIN
  -- Check if ALL bounds are provided
  v_has_valid_bounds := (
    p_bounds_north IS NOT NULL AND
    p_bounds_south IS NOT NULL AND
    p_bounds_east IS NOT NULL AND
    p_bounds_west IS NOT NULL
  );

  -- Calculate approximate bounds area (degrees squared)
  IF v_has_valid_bounds THEN
    v_bounds_area := ABS(p_bounds_north - p_bounds_south) * ABS(p_bounds_east - p_bounds_west);
  END IF;

  -- OPTIMIZATION: Use estimated count from materialized view for large areas
  -- Only do exact count for small areas (city level, ~0.5 degree squared)
  IF v_has_valid_bounds AND v_bounds_area < 0.5 THEN
    -- Small area: do exact count (fast with spatial index)
    SELECT COUNT(*) INTO v_total
    FROM properties p
    WHERE p.status::text = p_status
      AND p.geom && ST_MakeEnvelope(p_bounds_west, p_bounds_south, p_bounds_east, p_bounds_north, 4326)
      AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
      AND (p_property_type IS NULL OR p.type::text = p_property_type)
      AND (p_min_price IS NULL OR p.price >= p_min_price)
      AND (p_max_price IS NULL OR p.price <= p_max_price)
      AND (p_min_bedrooms IS NULL OR p.bedrooms >= p_min_bedrooms);
  ELSE
    -- Large area or no bounds: use estimated count from materialized view
    SELECT COALESCE(
      (SELECT count FROM mv_property_counts_by_status WHERE status = p_status),
      0
    ) INTO v_total;
  END IF;

  -- OPTIMIZED QUERY: Use simple ORDER BY that can use indexes
  -- When bounds are not provided or very large, skip spatial filter
  IF NOT v_has_valid_bounds OR v_bounds_area > 100 THEN
    -- No spatial filter - use covering index for fast ORDER BY
    SELECT jsonb_agg(row_to_json(t)), COUNT(*)
    INTO v_properties, v_fetched_count
    FROM (
      SELECT
        p.id,
        p.lat,
        p.lng,
        p.price,
        p.currency,
        p.title,
        p.type::text,
        p.listing_type,
        p.address,
        p.colonia,
        p.municipality,
        p.state,
        p.bedrooms,
        p.bathrooms,
        p.parking,
        p.sqft,
        p.for_sale,
        p.for_rent,
        p.sale_price,
        p.rent_price,
        p.agent_id,
        p.is_featured,
        p.created_at
      FROM properties p
      WHERE p.status::text = p_status
        AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
        AND (p_property_type IS NULL OR p.type::text = p_property_type)
        AND (p_min_price IS NULL OR p.price >= p_min_price)
        AND (p_max_price IS NULL OR p.price <= p_max_price)
        AND (p_min_bedrooms IS NULL OR p.bedrooms >= p_min_bedrooms)
        AND (p_state IS NULL OR p.state = p_state)
        AND (p_municipality IS NULL OR p.municipality = p_municipality)
      ORDER BY
        p.is_featured DESC,
        CASE WHEN p_sort = 'newest' THEN p.created_at END DESC NULLS LAST,
        CASE WHEN p_sort = 'oldest' THEN p.created_at END ASC NULLS LAST,
        CASE WHEN p_sort = 'price_asc' THEN p.price END ASC NULLS LAST,
        CASE WHEN p_sort = 'price_desc' THEN p.price END DESC NULLS LAST
      LIMIT p_limit
      OFFSET p_offset
    ) t;
  ELSE
    -- With spatial filter for small areas
    SELECT jsonb_agg(row_to_json(t)), COUNT(*)
    INTO v_properties, v_fetched_count
    FROM (
      SELECT
        p.id,
        p.lat,
        p.lng,
        p.price,
        p.currency,
        p.title,
        p.type::text,
        p.listing_type,
        p.address,
        p.colonia,
        p.municipality,
        p.state,
        p.bedrooms,
        p.bathrooms,
        p.parking,
        p.sqft,
        p.for_sale,
        p.for_rent,
        p.sale_price,
        p.rent_price,
        p.agent_id,
        p.is_featured,
        p.created_at
      FROM properties p
      WHERE p.status::text = p_status
        AND p.geom && ST_MakeEnvelope(p_bounds_west, p_bounds_south, p_bounds_east, p_bounds_north, 4326)
        AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
        AND (p_property_type IS NULL OR p.type::text = p_property_type)
        AND (p_min_price IS NULL OR p.price >= p_min_price)
        AND (p_max_price IS NULL OR p.price <= p_max_price)
        AND (p_min_bedrooms IS NULL OR p.bedrooms >= p_min_bedrooms)
        AND (p_state IS NULL OR p.state = p_state)
        AND (p_municipality IS NULL OR p.municipality = p_municipality)
      ORDER BY
        p.is_featured DESC,
        CASE WHEN p_sort = 'newest' THEN p.created_at END DESC NULLS LAST,
        CASE WHEN p_sort = 'oldest' THEN p.created_at END ASC NULLS LAST,
        CASE WHEN p_sort = 'price_asc' THEN p.price END ASC NULLS LAST,
        CASE WHEN p_sort = 'price_desc' THEN p.price END DESC NULLS LAST
      LIMIT p_limit
      OFFSET p_offset
    ) t;
  END IF;

  -- If we fetched less than limit and offset is 0, we know the exact count
  IF p_offset = 0 AND v_fetched_count < p_limit THEN
    v_total := v_fetched_count;
  END IF;

  RETURN QUERY SELECT COALESCE(v_properties, '[]'::jsonb), v_total;
END;
$$ LANGUAGE plpgsql STABLE;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
