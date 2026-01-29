-- =============================================
-- POPULATE SPATIAL TREE
-- This migration maps properties to leaf nodes and updates counts
-- Runs asynchronously in the database
-- =============================================

-- Create an index on spatial_tree_nodes for faster property lookup
CREATE INDEX IF NOT EXISTS idx_tree_nodes_bounds_level8
ON spatial_tree_nodes (min_lat, max_lat, min_lng, max_lng)
WHERE level = 8;

-- Map properties to leaf nodes using a more efficient approach
-- First, add a temporary column to properties for the leaf node
DO $$
DECLARE
  v_batch_size INT := 1000;
  v_offset INT := 0;
  v_count INT;
  v_total INT;
BEGIN
  -- Get total count
  SELECT COUNT(*) INTO v_total
  FROM properties
  WHERE status = 'activa'
    AND lat IS NOT NULL
    AND lng IS NOT NULL
    AND lat BETWEEN 14.0 AND 33.0
    AND lng BETWEEN -118.5 AND -86.0;

  RAISE NOTICE 'Total properties to map: %', v_total;

  -- Process in batches
  WHILE v_offset < v_total LOOP
    -- Insert mappings for this batch
    INSERT INTO property_node_mapping (property_id, leaf_node_id)
    SELECT
      sub.id,
      sub.leaf_id
    FROM (
      SELECT
        p.id,
        (
          SELECT stn.id
          FROM spatial_tree_nodes stn
          WHERE stn.level = 8
            AND p.lat >= stn.min_lat
            AND p.lat < stn.max_lat
            AND p.lng >= stn.min_lng
            AND p.lng < stn.max_lng
          LIMIT 1
        ) as leaf_id
      FROM properties p
      WHERE p.status = 'activa'
        AND p.lat IS NOT NULL
        AND p.lng IS NOT NULL
        AND p.lat BETWEEN 14.0 AND 33.0
        AND p.lng BETWEEN -118.5 AND -86.0
      ORDER BY p.id
      LIMIT v_batch_size
      OFFSET v_offset
    ) sub
    WHERE sub.leaf_id IS NOT NULL
    ON CONFLICT (property_id) DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_offset := v_offset + v_batch_size;

    RAISE NOTICE 'Processed % / % (inserted %)', v_offset, v_total, v_count;
  END LOOP;

  RAISE NOTICE 'Property mapping complete';
END;
$$;

-- Update counts from leaves to root
SELECT update_tree_counts();

-- Verify the tree
DO $$
DECLARE
  v_total_mapped INT;
  v_root_count INT;
BEGIN
  SELECT COUNT(*) INTO v_total_mapped FROM property_node_mapping;
  SELECT total_count INTO v_root_count FROM spatial_tree_nodes WHERE id = '0';

  RAISE NOTICE 'Properties mapped: %, Root count: %', v_total_mapped, v_root_count;

  IF v_total_mapped <> v_root_count THEN
    RAISE WARNING 'Mismatch between mapped properties and root count!';
  ELSE
    RAISE NOTICE 'Tree invariant verified: root count matches mapped properties';
  END IF;
END;
$$;
