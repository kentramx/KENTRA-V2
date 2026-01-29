-- =============================================
-- ENHANCED SPATIAL INFRASTRUCTURE FOR ENTERPRISE SCALE (5M+ Properties)
-- Uses geohash-based hierarchical indexing
-- Note: H3 extension not available on Supabase, using geohash alternative
-- Frontend uses h3-js for hexagonal visualization
-- =============================================

-- =============================================
-- ADD ADDITIONAL GEOHASH COLUMNS FOR FINER GRANULARITY
-- =============================================
-- geohash_3: ~156 km (existing)
-- geohash_4: ~39 km (existing)
-- geohash_5: ~4.9 km (existing)
-- geohash_6: ~1.2 km (existing)
-- geohash_7: ~153 m (NEW)
-- geohash_8: ~38 m (NEW)

ALTER TABLE properties ADD COLUMN IF NOT EXISTS geohash_7 text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS geohash_8 text;

-- =============================================
-- INDEXES FOR FAST QUERIES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_properties_geohash_7 ON properties(geohash_7) WHERE status = 'activa';
CREATE INDEX IF NOT EXISTS idx_properties_geohash_8 ON properties(geohash_8) WHERE status = 'activa';

-- Composite indexes for filtered queries
CREATE INDEX IF NOT EXISTS idx_properties_geohash_5_listing ON properties(geohash_5, listing_type) WHERE status = 'activa';
CREATE INDEX IF NOT EXISTS idx_properties_geohash_6_listing ON properties(geohash_6, listing_type) WHERE status = 'activa';
CREATE INDEX IF NOT EXISTS idx_properties_geohash_7_listing ON properties(geohash_7, listing_type) WHERE status = 'activa';

-- =============================================
-- UPDATE TRIGGER TO POPULATE NEW GEOHASH COLUMNS
-- =============================================
CREATE OR REPLACE FUNCTION update_property_geohashes()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    -- Generate geohashes at different precisions
    NEW.geohash_3 := ST_GeoHash(ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326), 3);
    NEW.geohash_4 := ST_GeoHash(ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326), 4);
    NEW.geohash_5 := ST_GeoHash(ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326), 5);
    NEW.geohash_6 := ST_GeoHash(ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326), 6);
    NEW.geohash_7 := ST_GeoHash(ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326), 7);
    NEW.geohash_8 := ST_GeoHash(ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326), 8);

    -- Also update the geom column if it exists
    IF NEW.geom IS NULL THEN
      NEW.geom := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_update_property_geohashes ON properties;
CREATE TRIGGER trigger_update_property_geohashes
  BEFORE INSERT OR UPDATE OF lat, lng ON properties
  FOR EACH ROW EXECUTE FUNCTION update_property_geohashes();

-- =============================================
-- BATCH UPDATE EXISTING PROPERTIES
-- Note: For large datasets, run this in batches via SQL Editor:
-- =============================================
-- Run this query multiple times until it returns 0 rows updated:
/*
UPDATE properties
SET
  geohash_7 = ST_GeoHash(ST_SetSRID(ST_MakePoint(lng, lat), 4326), 7),
  geohash_8 = ST_GeoHash(ST_SetSRID(ST_MakePoint(lng, lat), 4326), 8)
WHERE id IN (
  SELECT id FROM properties
  WHERE lat IS NOT NULL AND lng IS NOT NULL AND geohash_7 IS NULL
  LIMIT 5000
);
*/

-- For small datasets or initial setup, uncomment below:
-- UPDATE properties SET geohash_7 = ST_GeoHash(...) WHERE geohash_7 IS NULL LIMIT 5000;

-- =============================================
-- UTILITY FUNCTION: Get geohash precision for zoom level
-- =============================================
CREATE OR REPLACE FUNCTION get_geohash_precision_for_zoom(zoom integer)
RETURNS integer AS $$
BEGIN
  RETURN CASE
    WHEN zoom <= 6 THEN 3   -- ~156 km
    WHEN zoom <= 8 THEN 4   -- ~39 km
    WHEN zoom <= 10 THEN 5  -- ~4.9 km
    WHEN zoom <= 12 THEN 6  -- ~1.2 km
    WHEN zoom <= 14 THEN 7  -- ~153 m
    ELSE 8                  -- ~38 m
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================
-- COMMENTS
-- =============================================
COMMENT ON COLUMN properties.geohash_7 IS 'Geohash at precision 7 (~153m cells)';
COMMENT ON COLUMN properties.geohash_8 IS 'Geohash at precision 8 (~38m cells)';
COMMENT ON FUNCTION update_property_geohashes() IS 'Trigger to auto-populate geohash columns';
COMMENT ON FUNCTION get_geohash_precision_for_zoom(integer) IS 'Maps zoom level to appropriate geohash precision';
