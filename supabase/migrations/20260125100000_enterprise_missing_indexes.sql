-- ============================================================================
-- ENTERPRISE MISSING INDEXES
-- ============================================================================
-- Adds optimized indexes for prefix queries and image lookups
-- These complement the existing geohash indexes with pattern matching support
-- ============================================================================

-- ============================================================================
-- PART 1: GEOHASH PREFIX INDEXES (for LIKE 'abc%' queries)
-- ============================================================================
-- The existing indexes are btree but don't support prefix pattern matching
-- text_pattern_ops enables efficient LIKE 'prefix%' queries

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_geohash_4_prefix
  ON properties (geohash_4 text_pattern_ops)
  WHERE status = 'activa' AND geohash_4 IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_geohash_5_prefix
  ON properties (geohash_5 text_pattern_ops)
  WHERE status = 'activa' AND geohash_5 IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_geohash_6_prefix
  ON properties (geohash_6 text_pattern_ops)
  WHERE status = 'activa' AND geohash_6 IS NOT NULL;

-- ============================================================================
-- PART 2: IMAGES COMPOSITE INDEX
-- ============================================================================
-- Optimizes queries that fetch images for a property ordered by position
-- Common pattern: SELECT * FROM images WHERE property_id = ? ORDER BY position

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_images_property_position
  ON images (property_id, position)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- PART 3: PROPERTIES SPATIAL BOUNDS INDEX (for viewport queries)
-- ============================================================================
-- Optimizes the common WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_lat_lng_active
  ON properties (lat, lng)
  WHERE status = 'activa' AND lat IS NOT NULL AND lng IS NOT NULL;

-- ============================================================================
-- PART 4: PROPERTIES LISTING TYPE INDEX (filtered queries)
-- ============================================================================
-- Optimizes filtered searches by listing_type

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_listing_type_active
  ON properties (listing_type)
  WHERE status = 'activa';

-- ============================================================================
-- PART 5: ANALYZE TABLES
-- ============================================================================
-- Update statistics for query planner

ANALYZE properties;
ANALYZE images;
ANALYZE property_clusters;

-- ============================================================================
-- VERIFICATION QUERY (run manually to verify indexes)
-- ============================================================================
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename IN ('properties', 'images', 'property_clusters')
-- ORDER BY tablename, indexname;
