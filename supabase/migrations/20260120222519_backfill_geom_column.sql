-- ============================================================================
-- BACKFILL GEOM COLUMN FOR EXISTING PROPERTIES
-- ============================================================================
-- This migration populates the geom column for all properties that have
-- lat/lng coordinates but no geom value (likely seeded before the trigger existed).
-- ============================================================================

-- 1. Ensure PostGIS extension is enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Ensure geom column exists with proper type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'geom'
  ) THEN
    ALTER TABLE properties ADD COLUMN geom geometry(Point, 4326);
  END IF;
END $$;

-- 3. Create GIST index on geom column for fast spatial queries
CREATE INDEX IF NOT EXISTS idx_properties_geom ON properties USING GIST (geom);

-- 4. BACKFILL: Update all properties that have lat/lng but no geom
-- This is the critical fix for properties seeded before the trigger existed
UPDATE properties
SET geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
WHERE lat IS NOT NULL
  AND lng IS NOT NULL
  AND (geom IS NULL OR ST_IsEmpty(geom) = true);

-- Log how many properties were updated
DO $$
DECLARE
  updated_count integer;
  total_with_coords integer;
BEGIN
  SELECT COUNT(*) INTO total_with_coords
  FROM properties
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

  SELECT COUNT(*) INTO updated_count
  FROM properties
  WHERE geom IS NOT NULL;

  RAISE NOTICE 'Backfill complete: % of % properties now have geom data',
    updated_count, total_with_coords;
END $$;

-- 5. Recreate the trigger to ensure it exists (idempotent)
CREATE OR REPLACE FUNCTION sync_property_geom()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.geom = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_property_geom ON properties;
CREATE TRIGGER trg_sync_property_geom
BEFORE INSERT OR UPDATE OF lat, lng ON properties
FOR EACH ROW EXECUTE FUNCTION sync_property_geom();

-- 6. Verify the geom column is properly populated
DO $$
DECLARE
  null_geom_count integer;
  valid_geom_count integer;
BEGIN
  SELECT COUNT(*) INTO null_geom_count
  FROM properties
  WHERE lat IS NOT NULL AND lng IS NOT NULL AND geom IS NULL;

  SELECT COUNT(*) INTO valid_geom_count
  FROM properties
  WHERE geom IS NOT NULL;

  IF null_geom_count > 0 THEN
    RAISE WARNING '% properties still have null geom despite having lat/lng', null_geom_count;
  ELSE
    RAISE NOTICE 'SUCCESS: All % properties with coordinates have valid geom', valid_geom_count;
  END IF;
END $$;
