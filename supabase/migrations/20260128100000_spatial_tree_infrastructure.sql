-- =============================================
-- SPATIAL TREE INFRASTRUCTURE
-- Enterprise-grade clustering for 5M+ properties
-- Invariant: parent.count === SUM(children.count) ALWAYS
-- =============================================

-- Drop existing objects if they exist (for clean rebuild)
DROP TABLE IF EXISTS property_node_mapping CASCADE;
DROP TABLE IF EXISTS spatial_tree_nodes CASCADE;
DROP FUNCTION IF EXISTS build_spatial_tree CASCADE;
DROP FUNCTION IF EXISTS update_tree_counts CASCADE;
DROP FUNCTION IF EXISTS get_tree_clusters CASCADE;
DROP FUNCTION IF EXISTS get_node_children CASCADE;
DROP FUNCTION IF EXISTS get_node_properties CASCADE;
DROP FUNCTION IF EXISTS zoom_to_level CASCADE;

-- =============================================
-- TABLE: spatial_tree_nodes
-- Hierarchical spatial index with pre-aggregated counts
-- =============================================
CREATE TABLE spatial_tree_nodes (
  id TEXT PRIMARY KEY,                    -- e.g., "0", "0.NW", "0.NW.SE"
  level INT NOT NULL,                     -- 0=root, 1-7=intermediate, 8=leaf
  parent_id TEXT REFERENCES spatial_tree_nodes(id) ON DELETE CASCADE,

  -- Exact bounds of this node (fixed rectangle)
  min_lat DOUBLE PRECISION NOT NULL,
  max_lat DOUBLE PRECISION NOT NULL,
  min_lng DOUBLE PRECISION NOT NULL,
  max_lng DOUBLE PRECISION NOT NULL,

  -- Center point for cluster marker display
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,

  -- PRE-AGGREGATED COUNTS (the key to consistency!)
  -- Total
  total_count INT NOT NULL DEFAULT 0,

  -- By listing_type (fast path filter)
  count_venta INT NOT NULL DEFAULT 0,
  count_renta INT NOT NULL DEFAULT 0,

  -- By property_type (fast path filter)
  count_casa INT NOT NULL DEFAULT 0,
  count_departamento INT NOT NULL DEFAULT 0,
  count_terreno INT NOT NULL DEFAULT 0,
  count_oficina INT NOT NULL DEFAULT 0,
  count_local INT NOT NULL DEFAULT 0,
  count_otro INT NOT NULL DEFAULT 0,

  -- Price ranges for display
  min_price NUMERIC(14,2),
  max_price NUMERIC(14,2),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLE: property_node_mapping
-- Links each property to its leaf node
-- =============================================
CREATE TABLE property_node_mapping (
  property_id UUID PRIMARY KEY REFERENCES properties(id) ON DELETE CASCADE,
  leaf_node_id TEXT NOT NULL REFERENCES spatial_tree_nodes(id) ON DELETE CASCADE
);

-- =============================================
-- INDEXES
-- =============================================

-- Spatial index for viewport queries
CREATE INDEX idx_tree_nodes_spatial ON spatial_tree_nodes
  USING GIST (
    box(point(min_lng, min_lat), point(max_lng, max_lat))
  );

-- Level index for zoom-based queries
CREATE INDEX idx_tree_nodes_level ON spatial_tree_nodes(level);

-- Parent index for drill-down queries
CREATE INDEX idx_tree_nodes_parent ON spatial_tree_nodes(parent_id);

-- Counts index for filtering empty nodes
CREATE INDEX idx_tree_nodes_total ON spatial_tree_nodes(total_count) WHERE total_count > 0;

-- Property mapping index
CREATE INDEX idx_property_node_leaf ON property_node_mapping(leaf_node_id);

-- =============================================
-- FUNCTION: zoom_to_level
-- Maps map zoom level to tree level
-- =============================================
CREATE OR REPLACE FUNCTION zoom_to_level(p_zoom INT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_zoom <= 5 THEN 1   -- Country level
    WHEN p_zoom <= 7 THEN 2   -- Region level
    WHEN p_zoom <= 9 THEN 3   -- State level
    WHEN p_zoom <= 11 THEN 4  -- City level
    WHEN p_zoom <= 13 THEN 5  -- District level
    WHEN p_zoom <= 15 THEN 6  -- Neighborhood level
    ELSE 7                     -- Block level (near leaf)
  END;
$$;

-- =============================================
-- FUNCTION: build_spatial_tree
-- Builds the complete quadtree from scratch
-- Call during low-traffic periods
-- =============================================
CREATE OR REPLACE FUNCTION build_spatial_tree(
  p_max_level INT DEFAULT 8,
  -- Mexico bounding box (with buffer)
  p_min_lat DOUBLE PRECISION DEFAULT 14.0,
  p_max_lat DOUBLE PRECISION DEFAULT 33.0,
  p_min_lng DOUBLE PRECISION DEFAULT -118.5,
  p_max_lng DOUBLE PRECISION DEFAULT -86.0
)
RETURNS TABLE (
  phase TEXT,
  details TEXT,
  duration_ms INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_phase_start TIMESTAMPTZ;
  v_level INT;
  v_nodes_created INT;
  v_props_mapped INT;
BEGIN
  v_start := clock_timestamp();

  -- Phase 1: Clear existing data
  v_phase_start := clock_timestamp();
  DELETE FROM property_node_mapping;
  DELETE FROM spatial_tree_nodes;

  phase := 'clear';
  details := 'Cleared existing tree data';
  duration_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_phase_start)::INT;
  RETURN NEXT;

  -- Phase 2: Create root node
  v_phase_start := clock_timestamp();
  INSERT INTO spatial_tree_nodes (
    id, level, parent_id,
    min_lat, max_lat, min_lng, max_lng,
    center_lat, center_lng
  ) VALUES (
    '0', 0, NULL,
    p_min_lat, p_max_lat, p_min_lng, p_max_lng,
    (p_min_lat + p_max_lat) / 2,
    (p_min_lng + p_max_lng) / 2
  );

  phase := 'root';
  details := 'Created root node';
  duration_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_phase_start)::INT;
  RETURN NEXT;

  -- Phase 3: Build tree levels
  FOR v_level IN 1..p_max_level LOOP
    v_phase_start := clock_timestamp();

    -- Create 4 children for each node at previous level
    INSERT INTO spatial_tree_nodes (
      id, level, parent_id,
      min_lat, max_lat, min_lng, max_lng,
      center_lat, center_lng
    )
    SELECT
      parent.id || '.' || quadrant.name,
      v_level,
      parent.id,
      -- Calculate bounds for each quadrant
      CASE quadrant.name
        WHEN 'SW' THEN parent.min_lat
        WHEN 'SE' THEN parent.min_lat
        WHEN 'NW' THEN (parent.min_lat + parent.max_lat) / 2
        WHEN 'NE' THEN (parent.min_lat + parent.max_lat) / 2
      END as min_lat,
      CASE quadrant.name
        WHEN 'SW' THEN (parent.min_lat + parent.max_lat) / 2
        WHEN 'SE' THEN (parent.min_lat + parent.max_lat) / 2
        WHEN 'NW' THEN parent.max_lat
        WHEN 'NE' THEN parent.max_lat
      END as max_lat,
      CASE quadrant.name
        WHEN 'SW' THEN parent.min_lng
        WHEN 'NW' THEN parent.min_lng
        WHEN 'SE' THEN (parent.min_lng + parent.max_lng) / 2
        WHEN 'NE' THEN (parent.min_lng + parent.max_lng) / 2
      END as min_lng,
      CASE quadrant.name
        WHEN 'SW' THEN (parent.min_lng + parent.max_lng) / 2
        WHEN 'NW' THEN (parent.min_lng + parent.max_lng) / 2
        WHEN 'SE' THEN parent.max_lng
        WHEN 'NE' THEN parent.max_lng
      END as max_lng,
      -- Center point
      CASE quadrant.name
        WHEN 'SW' THEN (parent.min_lat + (parent.min_lat + parent.max_lat) / 2) / 2
        WHEN 'SE' THEN (parent.min_lat + (parent.min_lat + parent.max_lat) / 2) / 2
        WHEN 'NW' THEN ((parent.min_lat + parent.max_lat) / 2 + parent.max_lat) / 2
        WHEN 'NE' THEN ((parent.min_lat + parent.max_lat) / 2 + parent.max_lat) / 2
      END as center_lat,
      CASE quadrant.name
        WHEN 'SW' THEN (parent.min_lng + (parent.min_lng + parent.max_lng) / 2) / 2
        WHEN 'NW' THEN (parent.min_lng + (parent.min_lng + parent.max_lng) / 2) / 2
        WHEN 'SE' THEN ((parent.min_lng + parent.max_lng) / 2 + parent.max_lng) / 2
        WHEN 'NE' THEN ((parent.min_lng + parent.max_lng) / 2 + parent.max_lng) / 2
      END as center_lng
    FROM spatial_tree_nodes parent
    CROSS JOIN (VALUES ('NW'), ('NE'), ('SW'), ('SE')) AS quadrant(name)
    WHERE parent.level = v_level - 1;

    GET DIAGNOSTICS v_nodes_created = ROW_COUNT;

    phase := 'level_' || v_level;
    details := 'Created ' || v_nodes_created || ' nodes';
    duration_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_phase_start)::INT;
    RETURN NEXT;
  END LOOP;

  -- Phase 4: Map properties to leaf nodes
  v_phase_start := clock_timestamp();

  INSERT INTO property_node_mapping (property_id, leaf_node_id)
  SELECT
    p.id,
    (
      SELECT stn.id
      FROM spatial_tree_nodes stn
      WHERE stn.level = p_max_level
        AND p.lat >= stn.min_lat AND p.lat < stn.max_lat
        AND p.lng >= stn.min_lng AND p.lng < stn.max_lng
      LIMIT 1
    )
  FROM properties p
  WHERE p.status = 'activa'
    AND p.lat IS NOT NULL
    AND p.lng IS NOT NULL
    AND p.lat BETWEEN p_min_lat AND p_max_lat
    AND p.lng BETWEEN p_min_lng AND p_max_lng;

  GET DIAGNOSTICS v_props_mapped = ROW_COUNT;

  phase := 'mapping';
  details := 'Mapped ' || v_props_mapped || ' properties to leaf nodes';
  duration_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_phase_start)::INT;
  RETURN NEXT;

  -- Phase 5: Update counts
  v_phase_start := clock_timestamp();
  PERFORM update_tree_counts();

  phase := 'counts';
  details := 'Updated all node counts';
  duration_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_phase_start)::INT;
  RETURN NEXT;

  -- Final summary
  phase := 'complete';
  details := 'Total time';
  duration_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::INT;
  RETURN NEXT;
END;
$$;

-- =============================================
-- FUNCTION: update_tree_counts
-- Updates counts from leaf to root (bottom-up)
-- Guarantees: parent.count === SUM(children.count)
-- =============================================
CREATE OR REPLACE FUNCTION update_tree_counts()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_max_level INT;
  v_level INT;
BEGIN
  SELECT MAX(level) INTO v_max_level FROM spatial_tree_nodes;

  -- Step 1: Update leaf nodes from actual properties
  UPDATE spatial_tree_nodes stn
  SET
    total_count = COALESCE(agg.total, 0),
    count_venta = COALESCE(agg.venta, 0),
    count_renta = COALESCE(agg.renta, 0),
    count_casa = COALESCE(agg.casa, 0),
    count_departamento = COALESCE(agg.departamento, 0),
    count_terreno = COALESCE(agg.terreno, 0),
    count_oficina = COALESCE(agg.oficina, 0),
    count_local = COALESCE(agg.local_comercial, 0),
    count_otro = COALESCE(agg.otro, 0),
    min_price = agg.min_p,
    max_price = agg.max_p,
    center_lat = COALESCE(agg.avg_lat, stn.center_lat),
    center_lng = COALESCE(agg.avg_lng, stn.center_lng),
    updated_at = NOW()
  FROM (
    SELECT
      pnm.leaf_node_id,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE p.listing_type = 'venta') as venta,
      COUNT(*) FILTER (WHERE p.listing_type = 'renta') as renta,
      COUNT(*) FILTER (WHERE p.type = 'casa') as casa,
      COUNT(*) FILTER (WHERE p.type = 'departamento') as departamento,
      COUNT(*) FILTER (WHERE p.type = 'terreno') as terreno,
      COUNT(*) FILTER (WHERE p.type = 'oficina') as oficina,
      COUNT(*) FILTER (WHERE p.type = 'local') as local_comercial,
      COUNT(*) FILTER (WHERE p.type NOT IN ('casa', 'departamento', 'terreno', 'oficina', 'local') OR p.type IS NULL) as otro,
      MIN(p.price) as min_p,
      MAX(p.price) as max_p,
      AVG(p.lat) as avg_lat,
      AVG(p.lng) as avg_lng
    FROM property_node_mapping pnm
    JOIN properties p ON p.id = pnm.property_id
    WHERE p.status = 'activa'
    GROUP BY pnm.leaf_node_id
  ) agg
  WHERE stn.id = agg.leaf_node_id;

  -- Step 2: Propagate counts up the tree (leaf to root)
  FOR v_level IN REVERSE (v_max_level - 1)..0 LOOP
    UPDATE spatial_tree_nodes parent
    SET
      total_count = child_sums.total,
      count_venta = child_sums.venta,
      count_renta = child_sums.renta,
      count_casa = child_sums.casa,
      count_departamento = child_sums.departamento,
      count_terreno = child_sums.terreno,
      count_oficina = child_sums.oficina,
      count_local = child_sums.local_comercial,
      count_otro = child_sums.otro,
      min_price = child_sums.min_p,
      max_price = child_sums.max_p,
      updated_at = NOW()
    FROM (
      SELECT
        stn.parent_id,
        SUM(stn.total_count) as total,
        SUM(stn.count_venta) as venta,
        SUM(stn.count_renta) as renta,
        SUM(stn.count_casa) as casa,
        SUM(stn.count_departamento) as departamento,
        SUM(stn.count_terreno) as terreno,
        SUM(stn.count_oficina) as oficina,
        SUM(stn.count_local) as local_comercial,
        SUM(stn.count_otro) as otro,
        MIN(stn.min_price) as min_p,
        MAX(stn.max_price) as max_p
      FROM spatial_tree_nodes stn
      WHERE stn.level = v_level + 1
        AND stn.parent_id IS NOT NULL
      GROUP BY stn.parent_id
    ) child_sums
    WHERE parent.id = child_sums.parent_id
      AND parent.level = v_level;
  END LOOP;
END;
$$;

-- =============================================
-- FUNCTION: get_tree_clusters
-- Returns clusters for a viewport at appropriate level
-- =============================================
CREATE OR REPLACE FUNCTION get_tree_clusters(
  p_min_lat DOUBLE PRECISION,
  p_max_lat DOUBLE PRECISION,
  p_min_lng DOUBLE PRECISION,
  p_max_lng DOUBLE PRECISION,
  p_zoom INT,
  p_listing_type TEXT DEFAULT NULL,
  p_property_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  count INT,
  bounds_north DOUBLE PRECISION,
  bounds_south DOUBLE PRECISION,
  bounds_east DOUBLE PRECISION,
  bounds_west DOUBLE PRECISION,
  min_price NUMERIC,
  max_price NUMERIC
)
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
  v_level INT;
BEGIN
  v_level := zoom_to_level(p_zoom);

  RETURN QUERY
  SELECT
    stn.id,
    stn.center_lat as lat,
    stn.center_lng as lng,
    -- Apply filters to get correct count
    CASE
      WHEN p_listing_type = 'venta' AND p_property_type = 'casa' THEN
        LEAST(stn.count_venta, stn.count_casa)
      WHEN p_listing_type = 'venta' AND p_property_type = 'departamento' THEN
        LEAST(stn.count_venta, stn.count_departamento)
      WHEN p_listing_type = 'venta' AND p_property_type IS NOT NULL THEN
        stn.count_venta  -- Approximate for other types
      WHEN p_listing_type = 'renta' AND p_property_type = 'casa' THEN
        LEAST(stn.count_renta, stn.count_casa)
      WHEN p_listing_type = 'renta' AND p_property_type = 'departamento' THEN
        LEAST(stn.count_renta, stn.count_departamento)
      WHEN p_listing_type = 'renta' AND p_property_type IS NOT NULL THEN
        stn.count_renta  -- Approximate for other types
      WHEN p_listing_type = 'venta' THEN stn.count_venta
      WHEN p_listing_type = 'renta' THEN stn.count_renta
      WHEN p_property_type = 'casa' THEN stn.count_casa
      WHEN p_property_type = 'departamento' THEN stn.count_departamento
      WHEN p_property_type = 'terreno' THEN stn.count_terreno
      WHEN p_property_type = 'oficina' THEN stn.count_oficina
      WHEN p_property_type = 'local' THEN stn.count_local
      ELSE stn.total_count
    END::INT as count,
    stn.max_lat as bounds_north,
    stn.min_lat as bounds_south,
    stn.max_lng as bounds_east,
    stn.min_lng as bounds_west,
    stn.min_price,
    stn.max_price
  FROM spatial_tree_nodes stn
  WHERE stn.level = v_level
    -- Node intersects viewport
    AND stn.max_lat >= p_min_lat
    AND stn.min_lat <= p_max_lat
    AND stn.max_lng >= p_min_lng
    AND stn.min_lng <= p_max_lng
    -- Has properties matching filter
    AND CASE
      WHEN p_listing_type = 'venta' THEN stn.count_venta > 0
      WHEN p_listing_type = 'renta' THEN stn.count_renta > 0
      WHEN p_property_type = 'casa' THEN stn.count_casa > 0
      WHEN p_property_type = 'departamento' THEN stn.count_departamento > 0
      WHEN p_property_type = 'terreno' THEN stn.count_terreno > 0
      WHEN p_property_type = 'oficina' THEN stn.count_oficina > 0
      WHEN p_property_type = 'local' THEN stn.count_local > 0
      ELSE stn.total_count > 0
    END
  ORDER BY count DESC
  LIMIT 500;
END;
$$;

-- =============================================
-- FUNCTION: get_node_children
-- Returns children of a node (for drill-down)
-- GUARANTEES: SUM(children.count) === parent.count
-- =============================================
CREATE OR REPLACE FUNCTION get_node_children(
  p_parent_id TEXT,
  p_listing_type TEXT DEFAULT NULL,
  p_property_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  count INT,
  bounds_north DOUBLE PRECISION,
  bounds_south DOUBLE PRECISION,
  bounds_east DOUBLE PRECISION,
  bounds_west DOUBLE PRECISION,
  min_price NUMERIC,
  max_price NUMERIC,
  is_leaf BOOLEAN
)
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
  v_max_level INT;
BEGIN
  SELECT MAX(level) INTO v_max_level FROM spatial_tree_nodes;

  RETURN QUERY
  SELECT
    stn.id,
    stn.center_lat as lat,
    stn.center_lng as lng,
    CASE
      WHEN p_listing_type = 'venta' THEN stn.count_venta
      WHEN p_listing_type = 'renta' THEN stn.count_renta
      WHEN p_property_type = 'casa' THEN stn.count_casa
      WHEN p_property_type = 'departamento' THEN stn.count_departamento
      WHEN p_property_type = 'terreno' THEN stn.count_terreno
      WHEN p_property_type = 'oficina' THEN stn.count_oficina
      WHEN p_property_type = 'local' THEN stn.count_local
      ELSE stn.total_count
    END::INT as count,
    stn.max_lat as bounds_north,
    stn.min_lat as bounds_south,
    stn.max_lng as bounds_east,
    stn.min_lng as bounds_west,
    stn.min_price,
    stn.max_price,
    (stn.level = v_max_level) as is_leaf
  FROM spatial_tree_nodes stn
  WHERE stn.parent_id = p_parent_id
    AND CASE
      WHEN p_listing_type = 'venta' THEN stn.count_venta > 0
      WHEN p_listing_type = 'renta' THEN stn.count_renta > 0
      WHEN p_property_type = 'casa' THEN stn.count_casa > 0
      WHEN p_property_type = 'departamento' THEN stn.count_departamento > 0
      WHEN p_property_type = 'terreno' THEN stn.count_terreno > 0
      WHEN p_property_type = 'oficina' THEN stn.count_oficina > 0
      WHEN p_property_type = 'local' THEN stn.count_local > 0
      ELSE stn.total_count > 0
    END
  ORDER BY count DESC;
END;
$$;

-- =============================================
-- FUNCTION: get_node_properties
-- Returns properties for a leaf node (paginated)
-- =============================================
CREATE OR REPLACE FUNCTION get_node_properties(
  p_node_id TEXT,
  p_listing_type TEXT DEFAULT NULL,
  p_property_type TEXT DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  price NUMERIC,
  listing_type TEXT,
  property_type TEXT,
  bedrooms INT,
  bathrooms NUMERIC,
  sqft NUMERIC,
  neighborhood TEXT,
  city TEXT,
  state TEXT
)
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
  v_offset INT;
BEGIN
  v_offset := (p_page - 1) * p_limit;

  -- Get all descendant leaf nodes if this is not a leaf
  RETURN QUERY
  WITH RECURSIVE descendant_leaves AS (
    -- Start with the node itself
    SELECT stn.id, stn.level
    FROM spatial_tree_nodes stn
    WHERE stn.id = p_node_id

    UNION ALL

    -- Get children recursively
    SELECT child.id, child.level
    FROM spatial_tree_nodes child
    JOIN descendant_leaves parent ON child.parent_id = parent.id
  ),
  leaf_nodes AS (
    SELECT dl.id
    FROM descendant_leaves dl
    JOIN spatial_tree_nodes stn ON stn.id = dl.id
    WHERE stn.level = (SELECT MAX(level) FROM spatial_tree_nodes)
  )
  SELECT
    p.id,
    p.title,
    p.lat::DOUBLE PRECISION,
    p.lng::DOUBLE PRECISION,
    p.price,
    p.listing_type::TEXT,
    p.type::TEXT as property_type,
    p.bedrooms,
    p.bathrooms,
    p.sqft,
    p.colonia as neighborhood,
    p.municipality as city,
    p.state
  FROM properties p
  JOIN property_node_mapping pnm ON pnm.property_id = p.id
  WHERE pnm.leaf_node_id IN (SELECT ln.id FROM leaf_nodes ln)
    AND p.status = 'activa'
    AND (p_listing_type IS NULL OR p.listing_type::TEXT = p_listing_type)
    AND (p_property_type IS NULL OR p.type::TEXT = p_property_type)
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET v_offset;
END;
$$;

-- =============================================
-- PERMISSIONS
-- =============================================
GRANT SELECT ON spatial_tree_nodes TO anon, authenticated;
GRANT SELECT ON property_node_mapping TO anon, authenticated;
GRANT EXECUTE ON FUNCTION zoom_to_level TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_tree_clusters TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_node_children TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_node_properties TO anon, authenticated;
-- build/update functions only for service_role
GRANT EXECUTE ON FUNCTION build_spatial_tree TO service_role;
GRANT EXECUTE ON FUNCTION update_tree_counts TO service_role;

-- =============================================
-- COMMENTS
-- =============================================
COMMENT ON TABLE spatial_tree_nodes IS
'Quadtree structure for spatial clustering. Each node covers a fixed geographic rectangle.
INVARIANT: parent.count === SUM(children.count) by construction.';

COMMENT ON TABLE property_node_mapping IS
'Maps each property to its leaf node in the spatial tree.';

COMMENT ON FUNCTION build_spatial_tree IS
'Rebuilds the complete spatial tree. Call during low-traffic periods.
Creates 8 levels by default, covering Mexico''s bounding box.';

COMMENT ON FUNCTION update_tree_counts IS
'Updates counts from leaf to root. Maintains the tree invariant.';

COMMENT ON FUNCTION get_tree_clusters IS
'Returns clusters for viewport at appropriate tree level. Fast path: < 50ms.';

COMMENT ON FUNCTION get_node_children IS
'Returns children of a node for drill-down. Guarantees count consistency.';

COMMENT ON FUNCTION get_node_properties IS
'Returns paginated properties under a node (including all descendants).';
