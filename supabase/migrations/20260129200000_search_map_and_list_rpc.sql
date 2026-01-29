-- =============================================
-- RPC: search_map_and_list
-- Unified search for map clusters and property list
-- GUARANTEES: total is consistent between mapData and listItems
-- =============================================

-- Drop existing function if exists
DROP FUNCTION IF EXISTS search_map_and_list CASCADE;

-- Create the unified search function
CREATE OR REPLACE FUNCTION search_map_and_list(
  -- Viewport bounds
  p_bounds_north DOUBLE PRECISION,
  p_bounds_south DOUBLE PRECISION,
  p_bounds_east DOUBLE PRECISION,
  p_bounds_west DOUBLE PRECISION,
  -- Zoom level (determines cluster vs properties mode)
  p_zoom INT,
  -- Filters (all optional)
  p_listing_type TEXT DEFAULT NULL,
  p_property_type TEXT DEFAULT NULL,
  p_min_price NUMERIC DEFAULT NULL,
  p_max_price NUMERIC DEFAULT NULL,
  p_min_bedrooms INT DEFAULT NULL,
  p_max_bedrooms INT DEFAULT NULL,
  p_min_bathrooms NUMERIC DEFAULT NULL,
  p_min_sqft NUMERIC DEFAULT NULL,
  p_max_sqft NUMERIC DEFAULT NULL,
  -- Pagination
  p_page INT DEFAULT 1,
  p_limit INT DEFAULT 20,
  -- Optional: drill into specific node/geohash
  p_node_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_start_time TIMESTAMPTZ := clock_timestamp();
  v_mode TEXT;
  v_has_advanced_filters BOOLEAN;
  v_tree_level INT;
  v_total_count INT;
  v_filtered_total INT;
  v_clusters JSONB;
  v_list_items JSONB;
  v_offset INT;
  v_duration_ms INT;
  v_cluster_source TEXT;
BEGIN
  -- Calculate offset for pagination
  v_offset := (GREATEST(1, p_page) - 1) * GREATEST(1, LEAST(100, p_limit));

  -- Determine if we have advanced filters (beyond what tree supports)
  v_has_advanced_filters := (
    p_min_price IS NOT NULL OR
    p_max_price IS NOT NULL OR
    p_min_bedrooms IS NOT NULL OR
    p_max_bedrooms IS NOT NULL OR
    p_min_bathrooms IS NOT NULL OR
    p_min_sqft IS NOT NULL OR
    p_max_sqft IS NOT NULL
  );

  -- Determine mode based on zoom
  IF p_zoom >= 14 THEN
    v_mode := 'properties';
  ELSE
    v_mode := 'clusters';
  END IF;

  -- =============================================
  -- STEP 1: Calculate TOTAL from filtered query
  -- This is the SOURCE OF TRUTH for totals
  -- =============================================
  SELECT COUNT(*)
  INTO v_total_count
  FROM properties p
  WHERE p.status = 'activa'
    AND p.lat IS NOT NULL
    AND p.lng IS NOT NULL
    AND p.lat BETWEEN p_bounds_south AND p_bounds_north
    AND p.lng BETWEEN p_bounds_west AND p_bounds_east
    AND (p_listing_type IS NULL OR p.listing_type::TEXT = p_listing_type)
    AND (p_property_type IS NULL OR p.type::TEXT = p_property_type)
    AND (p_min_price IS NULL OR p.price >= p_min_price)
    AND (p_max_price IS NULL OR p.price <= p_max_price)
    AND (p_min_bedrooms IS NULL OR p.bedrooms >= p_min_bedrooms)
    AND (p_max_bedrooms IS NULL OR p.bedrooms <= p_max_bedrooms)
    AND (p_min_bathrooms IS NULL OR p.bathrooms >= p_min_bathrooms)
    AND (p_min_sqft IS NULL OR p.sqft >= p_min_sqft)
    AND (p_max_sqft IS NULL OR p.sqft <= p_max_sqft);

  v_filtered_total := v_total_count;

  -- =============================================
  -- STEP 2: Get CLUSTERS or PROPERTIES for map
  -- =============================================
  IF v_mode = 'clusters' THEN
    -- Use spatial tree for clustering
    v_tree_level := zoom_to_level(p_zoom);
    v_cluster_source := 'spatial_tree';

    IF v_has_advanced_filters THEN
      -- With advanced filters: dynamic clustering from properties
      v_cluster_source := 'dynamic_clustering';

      SELECT COALESCE(jsonb_agg(cluster_data), '[]'::jsonb)
      INTO v_clusters
      FROM (
        SELECT jsonb_build_object(
          'id', stn.id,
          'lat', stn.center_lat,
          'lng', stn.center_lng,
          'count', prop_count.cnt,
          'min_price', prop_count.min_p,
          'max_price', prop_count.max_p,
          'avg_price', prop_count.avg_p,
          'bounds', jsonb_build_object(
            'north', stn.max_lat,
            'south', stn.min_lat,
            'east', stn.max_lng,
            'west', stn.min_lng
          )
        ) as cluster_data
        FROM spatial_tree_nodes stn
        INNER JOIN LATERAL (
          SELECT
            COUNT(*) as cnt,
            MIN(p.price) as min_p,
            MAX(p.price) as max_p,
            AVG(p.price) as avg_p
          FROM properties p
          WHERE p.status = 'activa'
            AND p.lat >= stn.min_lat AND p.lat < stn.max_lat
            AND p.lng >= stn.min_lng AND p.lng < stn.max_lng
            AND (p_listing_type IS NULL OR p.listing_type::TEXT = p_listing_type)
            AND (p_property_type IS NULL OR p.type::TEXT = p_property_type)
            AND (p_min_price IS NULL OR p.price >= p_min_price)
            AND (p_max_price IS NULL OR p.price <= p_max_price)
            AND (p_min_bedrooms IS NULL OR p.bedrooms >= p_min_bedrooms)
            AND (p_max_bedrooms IS NULL OR p.bedrooms <= p_max_bedrooms)
            AND (p_min_bathrooms IS NULL OR p.bathrooms >= p_min_bathrooms)
            AND (p_min_sqft IS NULL OR p.sqft >= p_min_sqft)
            AND (p_max_sqft IS NULL OR p.sqft <= p_max_sqft)
        ) prop_count ON true
        WHERE stn.level = v_tree_level
          AND stn.max_lat >= p_bounds_south
          AND stn.min_lat <= p_bounds_north
          AND stn.max_lng >= p_bounds_west
          AND stn.min_lng <= p_bounds_east
          AND prop_count.cnt > 0
        ORDER BY prop_count.cnt DESC
        LIMIT 500
      ) sub;

    ELSE
      -- Without advanced filters: use pre-computed tree counts (fast path)
      SELECT COALESCE(jsonb_agg(cluster_data), '[]'::jsonb)
      INTO v_clusters
      FROM (
        SELECT jsonb_build_object(
          'id', c.id,
          'lat', c.lat,
          'lng', c.lng,
          'count', c.count,
          'min_price', c.min_price,
          'max_price', c.max_price,
          'bounds', jsonb_build_object(
            'north', c.bounds_north,
            'south', c.bounds_south,
            'east', c.bounds_east,
            'west', c.bounds_west
          )
        ) as cluster_data
        FROM get_tree_clusters(
          p_bounds_south, p_bounds_north,
          p_bounds_west, p_bounds_east,
          p_zoom,
          p_listing_type,
          p_property_type
        ) c
        WHERE c.count > 0
        ORDER BY c.count DESC
        LIMIT 500
      ) sub;
    END IF;

  ELSE
    -- Properties mode (zoom >= 14): return individual markers
    v_cluster_source := 'none';

    SELECT COALESCE(jsonb_agg(prop_data), '[]'::jsonb)
    INTO v_clusters
    FROM (
      SELECT jsonb_build_object(
        'id', p.id,
        'lat', p.lat,
        'lng', p.lng,
        'price', p.price,
        'listing_type', p.listing_type,
        'property_type', p.type
      ) as prop_data
      FROM properties p
      WHERE p.status = 'activa'
        AND p.lat BETWEEN p_bounds_south AND p_bounds_north
        AND p.lng BETWEEN p_bounds_west AND p_bounds_east
        AND (p_listing_type IS NULL OR p.listing_type::TEXT = p_listing_type)
        AND (p_property_type IS NULL OR p.type::TEXT = p_property_type)
        AND (p_min_price IS NULL OR p.price >= p_min_price)
        AND (p_max_price IS NULL OR p.price <= p_max_price)
        AND (p_min_bedrooms IS NULL OR p.bedrooms >= p_min_bedrooms)
        AND (p_max_bedrooms IS NULL OR p.bedrooms <= p_max_bedrooms)
        AND (p_min_bathrooms IS NULL OR p.bathrooms >= p_min_bathrooms)
        AND (p_min_sqft IS NULL OR p.sqft >= p_min_sqft)
        AND (p_max_sqft IS NULL OR p.sqft <= p_max_sqft)
      ORDER BY p.created_at DESC
      LIMIT 500
    ) sub;
  END IF;

  -- =============================================
  -- STEP 3: Get LIST ITEMS (paginated)
  -- Same filters as total count = guaranteed consistency
  -- =============================================
  SELECT COALESCE(jsonb_agg(list_item), '[]'::jsonb)
  INTO v_list_items
  FROM (
    SELECT jsonb_build_object(
      'id', p.id,
      'title', p.title,
      'code', p.code,
      'lat', p.lat,
      'lng', p.lng,
      'price', p.price,
      'listing_type', p.listing_type,
      'property_type', p.type,
      'bedrooms', p.bedrooms,
      'bathrooms', p.bathrooms,
      'sqft', p.sqft,
      'colonia', p.colonia,
      'municipality', p.municipality,
      'state', p.state,
      'main_image', (
        SELECT pi.url
        FROM property_images pi
        WHERE pi.property_id = p.id AND pi.is_main = true
        LIMIT 1
      )
    ) as list_item
    FROM properties p
    WHERE p.status = 'activa'
      AND p.lat IS NOT NULL
      AND p.lng IS NOT NULL
      AND p.lat BETWEEN p_bounds_south AND p_bounds_north
      AND p.lng BETWEEN p_bounds_west AND p_bounds_east
      AND (p_listing_type IS NULL OR p.listing_type::TEXT = p_listing_type)
      AND (p_property_type IS NULL OR p.type::TEXT = p_property_type)
      AND (p_min_price IS NULL OR p.price >= p_min_price)
      AND (p_max_price IS NULL OR p.price <= p_max_price)
      AND (p_min_bedrooms IS NULL OR p.bedrooms >= p_min_bedrooms)
      AND (p_max_bedrooms IS NULL OR p.bedrooms <= p_max_bedrooms)
      AND (p_min_bathrooms IS NULL OR p.bathrooms >= p_min_bathrooms)
      AND (p_min_sqft IS NULL OR p.sqft >= p_min_sqft)
      AND (p_max_sqft IS NULL OR p.sqft <= p_max_sqft)
    ORDER BY p.created_at DESC
    LIMIT p_limit
    OFFSET v_offset
  ) sub;

  -- Calculate duration
  v_duration_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INT;

  -- =============================================
  -- RETURN unified response
  -- =============================================
  RETURN jsonb_build_object(
    'mode', v_mode,
    'mapData', COALESCE(v_clusters, '[]'::jsonb),
    'listItems', COALESCE(v_list_items, '[]'::jsonb),
    'total', v_filtered_total,
    'page', p_page,
    'limit', p_limit,
    'totalPages', CEIL(v_filtered_total::NUMERIC / GREATEST(1, p_limit)),
    '_meta', jsonb_build_object(
      'duration_ms', v_duration_ms,
      'cluster_source', v_cluster_source,
      'tree_level', v_tree_level,
      'has_advanced_filters', v_has_advanced_filters,
      'bounds', jsonb_build_object(
        'north', p_bounds_north,
        'south', p_bounds_south,
        'east', p_bounds_east,
        'west', p_bounds_west
      ),
      'filters', jsonb_build_object(
        'listing_type', p_listing_type,
        'property_type', p_property_type,
        'min_price', p_min_price,
        'max_price', p_max_price,
        'min_bedrooms', p_min_bedrooms
      )
    )
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_map_and_list TO anon, authenticated, service_role;

-- Add helpful comment
COMMENT ON FUNCTION search_map_and_list IS
'Unified search function for map and list views.
GUARANTEES: total count is always consistent with both mapData and listItems.
Uses spatial tree for fast clustering, falls back to dynamic clustering for advanced filters.
Returns: { mode, mapData, listItems, total, page, totalPages, _meta }';

-- =============================================
-- HELPER: Create index for common filter patterns
-- =============================================
CREATE INDEX IF NOT EXISTS idx_properties_search_active
  ON properties(lat, lng, listing_type, type, price, bedrooms)
  WHERE status = 'activa' AND lat IS NOT NULL AND lng IS NOT NULL;

-- Partial index for venta
CREATE INDEX IF NOT EXISTS idx_properties_venta_search
  ON properties(lat, lng, price, type, bedrooms)
  WHERE status = 'activa' AND listing_type = 'venta' AND lat IS NOT NULL;

-- Partial index for renta
CREATE INDEX IF NOT EXISTS idx_properties_renta_search
  ON properties(lat, lng, price, type, bedrooms)
  WHERE status = 'activa' AND listing_type = 'renta' AND lat IS NOT NULL;
