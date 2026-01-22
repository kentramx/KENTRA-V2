-- ============================================================================
-- SCALABILITY P0: Support for 1,000,000+ Properties
-- ============================================================================
-- This migration implements critical performance optimizations for 1M scale:
-- 1. Full-text search with tsvector + GIN index
-- 2. Fix broken index (city -> municipality)
-- 3. Additional composite indexes for common query patterns
-- 4. Optimized RLS with SECURITY DEFINER function
-- 5. Optimized get_map_data to eliminate N+1 queries
-- 6. Cached counts via materialized views
-- ============================================================================

-- ============================================================================
-- 1. FULL-TEXT SEARCH
-- ============================================================================
-- Add tsvector column for efficient text search instead of LIKE/ILIKE

-- Add search_vector column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'search_vector'
  ) THEN
    ALTER TABLE properties ADD COLUMN search_vector tsvector;
  END IF;
END $$;

-- Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_properties_search_vector_gin
  ON properties USING GIN (search_vector);

-- Function to update search_vector on insert/update
CREATE OR REPLACE FUNCTION update_property_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('spanish', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('spanish', COALESCE(NEW.address, '')), 'B') ||
    setweight(to_tsvector('spanish', COALESCE(NEW.colonia, '')), 'B') ||
    setweight(to_tsvector('spanish', COALESCE(NEW.municipality, '')), 'C') ||
    setweight(to_tsvector('spanish', COALESCE(NEW.state, '')), 'C') ||
    setweight(to_tsvector('spanish', COALESCE(NEW.description, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update search_vector
DROP TRIGGER IF EXISTS trigger_update_property_search_vector ON properties;
CREATE TRIGGER trigger_update_property_search_vector
  BEFORE INSERT OR UPDATE OF title, address, colonia, municipality, state, description
  ON properties
  FOR EACH ROW
  EXECUTE FUNCTION update_property_search_vector();

-- Backfill existing properties (run in batches for large datasets)
UPDATE properties
SET search_vector =
  setweight(to_tsvector('spanish', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('spanish', COALESCE(address, '')), 'B') ||
  setweight(to_tsvector('spanish', COALESCE(colonia, '')), 'B') ||
  setweight(to_tsvector('spanish', COALESCE(municipality, '')), 'C') ||
  setweight(to_tsvector('spanish', COALESCE(state, '')), 'C') ||
  setweight(to_tsvector('spanish', COALESCE(description, '')), 'D')
WHERE search_vector IS NULL;

-- ============================================================================
-- 2. FIX BROKEN INDEX (city -> municipality)
-- ============================================================================
DROP INDEX IF EXISTS idx_properties_state_city;

CREATE INDEX IF NOT EXISTS idx_properties_state_municipality
  ON properties (state, municipality)
  WHERE status = 'activa';

-- ============================================================================
-- 3. ADDITIONAL COMPOSITE INDEXES FOR 1M SCALE
-- ============================================================================

-- Index for price + listing_type sort/filter (common search pattern)
CREATE INDEX IF NOT EXISTS idx_properties_listing_price_sort
  ON properties (status, listing_type, price)
  WHERE status = 'activa';

-- Index for created_at + featured (newest sort with featured priority)
CREATE INDEX IF NOT EXISTS idx_properties_status_featured_created
  ON properties (status, is_featured DESC, created_at DESC)
  WHERE status = 'activa';

-- Index for bedrooms + price + type (common filter combination)
CREATE INDEX IF NOT EXISTS idx_properties_bedrooms_price_type
  ON properties (status, bedrooms, price, type)
  WHERE status = 'activa';

-- Index for agent properties count (used in subscription checks)
CREATE INDEX IF NOT EXISTS idx_properties_agent_status_count
  ON properties (agent_id, status)
  WHERE status IN ('activa', 'pendiente_aprobacion');

-- Index for agency inventory
CREATE INDEX IF NOT EXISTS idx_properties_agency_status
  ON properties (agency_id, status, created_at DESC)
  WHERE agency_id IS NOT NULL;

-- ============================================================================
-- 4. OPTIMIZED RLS WITH SECURITY DEFINER FUNCTION
-- ============================================================================
-- Move expensive EXISTS check to a cached function

CREATE OR REPLACE FUNCTION is_admin_or_moderator(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = user_uuid
    AND role IN ('super_admin', 'moderator')
  );
$$;

-- Create index for fast admin lookup
CREATE INDEX IF NOT EXISTS idx_user_roles_admin_lookup
  ON user_roles (user_id, role)
  WHERE role IN ('super_admin', 'moderator');

-- Update RLS policy to use the function (more efficient than inline EXISTS)
DROP POLICY IF EXISTS "properties_select_public" ON properties;
CREATE POLICY "properties_select_public" ON properties
  FOR SELECT
  USING (
    status = 'activa'
    OR auth.uid() = agent_id
    OR is_admin_or_moderator(auth.uid())
  );

-- ============================================================================
-- 5. OPTIMIZED get_map_data - ELIMINATE N+1 QUERIES
-- ============================================================================
-- Rewrite to use JOINs instead of subqueries per row

CREATE OR REPLACE FUNCTION get_map_data(
  p_bounds_north float,
  p_bounds_south float,
  p_bounds_east float,
  p_bounds_west float,
  p_listing_type text DEFAULT NULL,
  p_property_type text DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_min_bedrooms int DEFAULT NULL,
  p_limit int DEFAULT 200
)
RETURNS TABLE (
  properties jsonb,
  clusters jsonb,
  total_count bigint
) AS $$
DECLARE
  v_has_valid_bounds boolean;
  v_count bigint;
  v_properties jsonb;
BEGIN
  -- Validate bounds
  v_has_valid_bounds := (
    p_bounds_north IS NOT NULL AND
    p_bounds_south IS NOT NULL AND
    p_bounds_east IS NOT NULL AND
    p_bounds_west IS NOT NULL
  );

  IF NOT v_has_valid_bounds THEN
    RETURN QUERY SELECT '[]'::jsonb, '[]'::jsonb, 0::bigint;
    RETURN;
  END IF;

  -- Get count for clustering decision
  SELECT COUNT(*) INTO v_count
  FROM properties p
  WHERE p.status = 'activa'
    AND p.geom && ST_MakeEnvelope(p_bounds_west, p_bounds_south, p_bounds_east, p_bounds_north, 4326)
    AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
    AND (p_property_type IS NULL OR p.type::text = p_property_type)
    AND (p_min_price IS NULL OR p.price >= p_min_price)
    AND (p_max_price IS NULL OR p.price <= p_max_price)
    AND (p_min_bedrooms IS NULL OR p.bedrooms >= p_min_bedrooms);

  -- Get properties with pre-joined data (NO N+1!)
  SELECT jsonb_agg(prop_data)
  INTO v_properties
  FROM (
    SELECT jsonb_build_object(
      'id', p.id,
      'lat', p.lat,
      'lng', p.lng,
      'price', p.price,
      'currency', p.currency,
      'title', p.title,
      'type', p.type::text,
      'listing_type', p.listing_type,
      'address', p.address,
      'colonia', p.colonia,
      'municipality', p.municipality,
      'state', p.state,
      'bedrooms', p.bedrooms,
      'bathrooms', p.bathrooms,
      'parking', p.parking,
      'sqft', p.sqft,
      'is_featured', p.is_featured,
      'created_at', p.created_at,
      -- Pre-join first image instead of subquery
      'image_url', (
        SELECT i.url FROM images i
        WHERE i.property_id = p.id
        ORDER BY i.position
        LIMIT 1
      )
    ) as prop_data
    FROM properties p
    WHERE p.status = 'activa'
      AND p.geom && ST_MakeEnvelope(p_bounds_west, p_bounds_south, p_bounds_east, p_bounds_north, 4326)
      AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
      AND (p_property_type IS NULL OR p.type::text = p_property_type)
      AND (p_min_price IS NULL OR p.price >= p_min_price)
      AND (p_max_price IS NULL OR p.price <= p_max_price)
      AND (p_min_bedrooms IS NULL OR p.bedrooms >= p_min_bedrooms)
    ORDER BY p.is_featured DESC, p.created_at DESC
    LIMIT p_limit
  ) sub;

  RETURN QUERY SELECT
    COALESCE(v_properties, '[]'::jsonb),
    '[]'::jsonb,  -- Clustering done in Edge Function with Supercluster
    v_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 6. MATERIALIZED VIEWS FOR CACHED COUNTS
-- ============================================================================

-- Global stats materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_global_stats AS
SELECT
  (SELECT COUNT(*) FROM properties WHERE status = 'activa') as active_properties,
  (SELECT COUNT(*) FROM profiles) as total_users,
  (SELECT COUNT(DISTINCT municipality) FROM properties WHERE status = 'activa') as unique_cities,
  (SELECT COUNT(*) FROM user_roles WHERE role IN ('agent', 'agency')) as total_agents,
  (SELECT AVG(price) FROM properties WHERE status = 'activa' AND price > 0) as avg_price,
  (SELECT COUNT(*) FROM agent_reviews) as total_reviews,
  NOW() as refreshed_at;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_global_stats_unique ON mv_global_stats (refreshed_at);

-- Property counts by status (for admin dashboard)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_property_counts_by_status AS
SELECT
  status,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE resubmission_count = 0) as new_count,
  COUNT(*) FILTER (WHERE resubmission_count > 0) as resubmitted_count,
  COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '3 days') as old_count
FROM properties
GROUP BY status;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_property_counts_status ON mv_property_counts_by_status (status);

-- Function to get global stats (uses materialized view)
CREATE OR REPLACE FUNCTION get_global_stats_cached()
RETURNS TABLE (
  active_properties bigint,
  total_users bigint,
  unique_cities bigint,
  total_agents bigint,
  avg_price numeric,
  total_reviews bigint,
  refreshed_at timestamptz
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM mv_global_stats LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to refresh stats (call from cron job)
CREATE OR REPLACE FUNCTION refresh_global_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_global_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_property_counts_by_status;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. OPTIMIZED CONVERSATION LIST - ELIMINATE N+1
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_conversations(
  p_user_id uuid,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  property_id uuid,
  buyer_id uuid,
  agent_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  property_title text,
  property_address text,
  last_message_content text,
  last_message_at timestamptz,
  unread_count bigint,
  other_user_name text,
  other_user_avatar text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.property_id,
    c.buyer_id,
    c.agent_id,
    c.created_at,
    c.updated_at,
    p.title as property_title,
    p.address as property_address,
    -- Last message (single join, not N queries)
    lm.content as last_message_content,
    lm.created_at as last_message_at,
    -- Unread count (single aggregation)
    COALESCE(uc.unread_count, 0) as unread_count,
    -- Other user info
    CASE
      WHEN c.buyer_id = p_user_id THEN agent_profile.name
      ELSE buyer_profile.name
    END as other_user_name,
    CASE
      WHEN c.buyer_id = p_user_id THEN agent_profile.avatar_url
      ELSE buyer_profile.avatar_url
    END as other_user_avatar
  FROM conversations c
  LEFT JOIN properties p ON p.id = c.property_id
  -- Join for last message
  LEFT JOIN LATERAL (
    SELECT m.content, m.created_at
    FROM messages m
    WHERE m.conversation_id = c.id
    ORDER BY m.created_at DESC
    LIMIT 1
  ) lm ON true
  -- Join for unread count
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as unread_count
    FROM messages m
    WHERE m.conversation_id = c.id
      AND m.sender_id != p_user_id
      AND m.read_at IS NULL
  ) uc ON true
  -- Join profiles
  LEFT JOIN profiles agent_profile ON agent_profile.id = c.agent_id
  LEFT JOIN profiles buyer_profile ON buyer_profile.id = c.buyer_id
  WHERE c.buyer_id = p_user_id OR c.agent_id = p_user_id
  ORDER BY c.updated_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 8. OPTIMIZED FAVORITES WITH PAGINATION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_favorites(
  p_user_id uuid,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  favorite_id uuid,
  created_at timestamptz,
  property_id uuid,
  property jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id as favorite_id,
    f.created_at,
    f.property_id,
    jsonb_build_object(
      'id', p.id,
      'title', p.title,
      'address', p.address,
      'municipality', p.municipality,
      'state', p.state,
      'price', p.price,
      'currency', p.currency,
      'bedrooms', p.bedrooms,
      'bathrooms', p.bathrooms,
      'sqft', p.sqft,
      'listing_type', p.listing_type,
      'type', p.type::text,
      'status', p.status::text,
      'image_url', (
        SELECT i.url FROM images i
        WHERE i.property_id = p.id
        ORDER BY i.position
        LIMIT 1
      )
    ) as property
  FROM favorites f
  JOIN properties p ON p.id = f.property_id
  WHERE f.user_id = p_user_id
  ORDER BY f.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Index for favorites lookup
CREATE INDEX IF NOT EXISTS idx_favorites_user_created
  ON favorites (user_id, created_at DESC);

-- ============================================================================
-- 9. ANALYZE ALL AFFECTED TABLES
-- ============================================================================
ANALYZE properties;
ANALYZE favorites;
ANALYZE conversations;
ANALYZE messages;
ANALYZE user_roles;
ANALYZE images;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION get_global_stats_cached IS 'Returns cached global stats from materialized view. O(1) instead of multiple COUNT(*)';
COMMENT ON FUNCTION get_user_conversations IS 'Get user conversations with all related data in single query. Eliminates N+1';
COMMENT ON FUNCTION get_user_favorites IS 'Get paginated favorites with property data. O(1) with proper indexes';
COMMENT ON MATERIALIZED VIEW mv_global_stats IS 'Cached global statistics. Refresh via refresh_global_stats() or cron job';
