-- =============================================
-- CLEANUP: Remove all map-related infrastructure
-- This migration removes all map components to prepare for a clean rebuild
-- PRESERVES: lat, lng, geom columns and basic location data
-- =============================================

-- =============================================
-- STEP 1: DROP TRIGGERS FIRST
-- =============================================
DROP TRIGGER IF EXISTS trigger_update_property_geohash ON properties;
DROP TRIGGER IF EXISTS trigger_update_property_geohashes ON properties;

-- =============================================
-- STEP 2: DROP MATERIALIZED VIEWS
-- =============================================
DROP MATERIALIZED VIEW IF EXISTS mv_property_clusters_gh3 CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_property_clusters_gh4 CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_property_clusters_gh5 CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_geohash_clusters_7 CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_geohash_clusters_7_all CASCADE;

-- =============================================
-- STEP 3: DROP TABLES (CASCADE handles foreign keys)
-- =============================================
DROP TABLE IF EXISTS property_node_mapping CASCADE;
DROP TABLE IF EXISTS spatial_tree_nodes CASCADE;
DROP TABLE IF EXISTS property_clusters CASCADE;

-- =============================================
-- STEP 4: DROP ALL MAP-RELATED FUNCTIONS
-- =============================================

-- Geohash functions
DROP FUNCTION IF EXISTS encode_geohash(double precision, double precision, integer) CASCADE;
DROP FUNCTION IF EXISTS update_property_geohash() CASCADE;
DROP FUNCTION IF EXISTS update_property_geohashes() CASCADE;
DROP FUNCTION IF EXISTS backfill_geohash_batched(integer) CASCADE;
DROP FUNCTION IF EXISTS get_geohash_precision_for_zoom(integer) CASCADE;

-- Cluster functions
DROP FUNCTION IF EXISTS refresh_property_clusters(integer[]) CASCADE;
DROP FUNCTION IF EXISTS get_clusters_in_viewport(double precision, double precision, double precision, double precision, integer, text, integer) CASCADE;
DROP FUNCTION IF EXISTS get_clusters_gh3(float, float, float, float, text, text, numeric, numeric, integer) CASCADE;
DROP FUNCTION IF EXISTS get_clusters_gh4(float, float, float, float, text, text, numeric, numeric, integer) CASCADE;
DROP FUNCTION IF EXISTS get_clusters_gh5(float, float, float, float, text, text, numeric, numeric, integer) CASCADE;
DROP FUNCTION IF EXISTS refresh_cluster_views() CASCADE;
DROP FUNCTION IF EXISTS refresh_geohash_clusters_extended() CASCADE;

-- Spatial tree functions
DROP FUNCTION IF EXISTS build_spatial_tree(integer, double precision, double precision, double precision, double precision) CASCADE;
DROP FUNCTION IF EXISTS update_tree_counts() CASCADE;
DROP FUNCTION IF EXISTS get_tree_clusters(double precision, double precision, double precision, double precision, integer, text, text) CASCADE;
DROP FUNCTION IF EXISTS get_node_children(text, text, text) CASCADE;
DROP FUNCTION IF EXISTS get_node_properties(text, text, text, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS zoom_to_level(integer) CASCADE;
DROP FUNCTION IF EXISTS populate_spatial_tree() CASCADE;

-- Martin tile functions
DROP FUNCTION IF EXISTS get_geohash_cluster_tiles(integer, integer, integer, json) CASCADE;
DROP FUNCTION IF EXISTS get_property_tiles(integer, integer, integer, json) CASCADE;

-- Unified search function
DROP FUNCTION IF EXISTS search_map_and_list(
  double precision, double precision, double precision, double precision,
  integer, text, text, numeric, numeric, integer, integer, numeric, numeric, numeric,
  integer, integer, text
) CASCADE;

-- Populate geohash functions
DROP FUNCTION IF EXISTS populate_geohashes_batch(integer, integer) CASCADE;
DROP FUNCTION IF EXISTS populate_geohash_batch(integer, integer) CASCADE;

-- =============================================
-- STEP 5: DROP GEOHASH INDEXES ON PROPERTIES
-- =============================================
DROP INDEX IF EXISTS idx_properties_geohash_3;
DROP INDEX IF EXISTS idx_properties_geohash_4;
DROP INDEX IF EXISTS idx_properties_geohash_5;
DROP INDEX IF EXISTS idx_properties_geohash_6;
DROP INDEX IF EXISTS idx_properties_geohash_7;
DROP INDEX IF EXISTS idx_properties_geohash_8;
DROP INDEX IF EXISTS idx_properties_geohash_5_listing;
DROP INDEX IF EXISTS idx_properties_geohash_6_listing;
DROP INDEX IF EXISTS idx_properties_geohash_7_listing;
DROP INDEX IF EXISTS idx_properties_search_active;
DROP INDEX IF EXISTS idx_properties_venta_search;
DROP INDEX IF EXISTS idx_properties_renta_search;

-- =============================================
-- STEP 6: DROP GEOHASH COLUMNS FROM PROPERTIES
-- =============================================
ALTER TABLE properties DROP COLUMN IF EXISTS geohash_3;
ALTER TABLE properties DROP COLUMN IF EXISTS geohash_4;
ALTER TABLE properties DROP COLUMN IF EXISTS geohash_5;
ALTER TABLE properties DROP COLUMN IF EXISTS geohash_6;
ALTER TABLE properties DROP COLUMN IF EXISTS geohash_7;
ALTER TABLE properties DROP COLUMN IF EXISTS geohash_8;

-- =============================================
-- VERIFICATION COMMENT
-- =============================================
-- After running this migration, the following should remain:
-- - properties.lat (double precision)
-- - properties.lng (double precision)
-- - properties.geom (geometry, if exists)
-- - properties.state, municipality, colonia (location text fields)
--
-- All map clustering infrastructure has been removed.
-- Ready for clean rebuild with Lovable.
-- =============================================
