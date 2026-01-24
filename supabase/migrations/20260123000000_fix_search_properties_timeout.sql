-- ============================================================================
-- FIX: search_properties timeout with 800K+ properties
-- ============================================================================
-- PROBLEM: The COUNT(*) operation on 800K+ rows causes statement timeout
-- SOLUTION:
--   1. Remove exact COUNT for large result sets
--   2. Use estimated count from materialized view
--   3. Only do exact count when bounds are very restricted
-- ============================================================================

-- Create materialized view for global property counts if not exists
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_property_counts_by_status AS
SELECT
  status::text as status,
  COUNT(*) as count
FROM properties
GROUP BY status;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_property_counts_status
ON mv_property_counts_by_status (status);

-- Create a fast global stats view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_global_stats AS
SELECT
  COUNT(*) as total_properties,
  COUNT(*) FILTER (WHERE status = 'activa') as active_properties,
  MAX(created_at) as last_property_created
FROM properties;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_global_stats_unique
ON mv_global_stats ((1));

-- Refresh the views
REFRESH MATERIALIZED VIEW mv_property_counts_by_status;
REFRESH MATERIALIZED VIEW mv_global_stats;

-- ============================================================================
-- OPTIMIZED search_properties function
-- ============================================================================
-- Changes:
-- 1. Returns estimated count from materialized view instead of exact COUNT(*)
-- 2. Only does expensive count when result set is likely small (tight bounds)
-- 3. Much faster: O(1) for count instead of O(n)
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

  -- OPTIMIZATION: Get estimated total from materialized view
  -- Only do exact count for small areas (city level or below, ~0.5 degree squared)
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

  -- Get properties (this uses the spatial index efficiently)
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
      AND (NOT v_has_valid_bounds OR p.geom && ST_MakeEnvelope(p_bounds_west, p_bounds_south, p_bounds_east, p_bounds_north, 4326))
      AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
      AND (p_property_type IS NULL OR p.type::text = p_property_type)
      AND (p_min_price IS NULL OR p.price >= p_min_price)
      AND (p_max_price IS NULL OR p.price <= p_max_price)
      AND (p_min_bedrooms IS NULL OR p.bedrooms >= p_min_bedrooms)
      AND (p_state IS NULL OR p.state = p_state)
      AND (p_municipality IS NULL OR p.municipality = p_municipality)
    ORDER BY
      CASE WHEN p_sort = 'newest' THEN p.created_at END DESC,
      CASE WHEN p_sort = 'oldest' THEN p.created_at END ASC,
      CASE WHEN p_sort = 'price_asc' THEN p.price END ASC,
      CASE WHEN p_sort = 'price_desc' THEN p.price END DESC,
      p.is_featured DESC
    LIMIT p_limit
    OFFSET p_offset
  ) t;

  -- If we fetched less than limit and offset is 0, we know the exact count
  IF p_offset = 0 AND v_fetched_count < p_limit THEN
    v_total := v_fetched_count;
  END IF;

  RETURN QUERY SELECT COALESCE(v_properties, '[]'::jsonb), v_total;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Also optimize search_properties_cursor to avoid COUNT timeout
-- ============================================================================

CREATE OR REPLACE FUNCTION search_properties_cursor(
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
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_direction text DEFAULT 'next'
)
RETURNS TABLE (
  properties jsonb,
  total_count bigint,
  next_cursor jsonb,
  prev_cursor jsonb,
  has_more boolean
) AS $$
DECLARE
  v_properties jsonb;
  v_total bigint;
  v_has_valid_bounds boolean;
  v_bounds_area float;
  v_has_more boolean := false;
  v_fetched_count int;
BEGIN
  -- Check if ALL bounds are provided
  v_has_valid_bounds := (
    p_bounds_north IS NOT NULL AND
    p_bounds_south IS NOT NULL AND
    p_bounds_east IS NOT NULL AND
    p_bounds_west IS NOT NULL
  );

  -- Calculate bounds area
  IF v_has_valid_bounds THEN
    v_bounds_area := ABS(p_bounds_north - p_bounds_south) * ABS(p_bounds_east - p_bounds_west);
  END IF;

  -- OPTIMIZATION: Use estimated count from materialized view
  -- Only do exact count for small areas
  IF v_has_valid_bounds AND v_bounds_area < 0.5 THEN
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
    SELECT COALESCE(
      (SELECT count FROM mv_property_counts_by_status WHERE status = p_status),
      0
    ) INTO v_total;
  END IF;

  -- Fetch properties with cursor-based pagination
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
      AND (NOT v_has_valid_bounds OR p.geom && ST_MakeEnvelope(p_bounds_west, p_bounds_south, p_bounds_east, p_bounds_north, 4326))
      AND (
        p_cursor_created_at IS NULL
        OR (
          CASE
            WHEN p_sort = 'newest' AND p_direction = 'next' THEN
              (p.created_at, p.id) < (p_cursor_created_at, p_cursor_id)
            WHEN p_sort = 'newest' AND p_direction = 'prev' THEN
              (p.created_at, p.id) > (p_cursor_created_at, p_cursor_id)
            WHEN p_sort = 'oldest' AND p_direction = 'next' THEN
              (p.created_at, p.id) > (p_cursor_created_at, p_cursor_id)
            WHEN p_sort = 'oldest' AND p_direction = 'prev' THEN
              (p.created_at, p.id) < (p_cursor_created_at, p_cursor_id)
            ELSE true
          END
        )
      )
    ORDER BY
      CASE WHEN p_sort = 'newest' THEN p.created_at END DESC,
      CASE WHEN p_sort = 'oldest' THEN p.created_at END ASC,
      CASE WHEN p_sort = 'price_asc' THEN p.price END ASC,
      CASE WHEN p_sort = 'price_desc' THEN p.price END DESC,
      p.is_featured DESC,
      p.id DESC
    LIMIT p_limit + 1
  ) t;

  -- Check if there are more results
  IF v_fetched_count > p_limit THEN
    v_has_more := true;
    v_properties := (
      SELECT jsonb_agg(elem)
      FROM (
        SELECT elem
        FROM jsonb_array_elements(v_properties) WITH ORDINALITY arr(elem, idx)
        WHERE idx <= p_limit
      ) sub
    );
  END IF;

  RETURN QUERY SELECT
    COALESCE(v_properties, '[]'::jsonb),
    v_total,
    CASE
      WHEN v_has_more AND jsonb_array_length(COALESCE(v_properties, '[]'::jsonb)) > 0 THEN
        jsonb_build_object(
          'created_at', (v_properties->(jsonb_array_length(v_properties) - 1))->>'created_at',
          'id', (v_properties->(jsonb_array_length(v_properties) - 1))->>'id'
        )
      ELSE NULL
    END,
    CASE
      WHEN p_cursor_created_at IS NOT NULL AND jsonb_array_length(COALESCE(v_properties, '[]'::jsonb)) > 0 THEN
        jsonb_build_object(
          'created_at', v_properties->0->>'created_at',
          'id', v_properties->0->>'id'
        )
      ELSE NULL
    END,
    v_has_more;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Analyze tables for query planner
-- ============================================================================
ANALYZE properties;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON FUNCTION search_properties IS 'Optimized property search. Uses estimated count from materialized view to avoid COUNT(*) timeout on large datasets.';
COMMENT ON FUNCTION search_properties_cursor IS 'Cursor-based pagination with optimized count estimation.';
