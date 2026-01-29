-- =============================================
-- MARTIN TILE SERVER MVT FUNCTIONS
-- Placeholder for future Martin tile server integration
-- Note: Martin deployment is optional and can be done later
-- =============================================

-- This migration is a placeholder. The actual MVT functions
-- will be implemented when Martin tile server is deployed.
-- For now, the application uses the existing geohash-based
-- clustering via Edge Functions.

-- Function to generate MVT tiles from geohash clusters
-- This can be used with Martin or any MVT-capable tile server
CREATE OR REPLACE FUNCTION get_geohash_cluster_tiles(
  z integer,
  x integer,
  y integer,
  query_params json DEFAULT '{}'::json
)
RETURNS bytea AS $$
DECLARE
  mvt bytea;
  v_precision integer;
  v_listing_type text;
  v_bounds geometry;
BEGIN
  -- Extract optional listing_type filter
  v_listing_type := query_params->>'listing_type';

  -- Get tile bounds
  v_bounds := ST_TileEnvelope(z, x, y);

  -- Map zoom to geohash precision
  v_precision := CASE
    WHEN z <= 6 THEN 3
    WHEN z <= 8 THEN 4
    WHEN z <= 10 THEN 5
    WHEN z <= 12 THEN 6
    ELSE 7
  END;

  -- Generate MVT from properties
  WITH clusters AS (
    SELECT
      CASE v_precision
        WHEN 3 THEN geohash_3
        WHEN 4 THEN geohash_4
        WHEN 5 THEN geohash_5
        WHEN 6 THEN geohash_6
        ELSE geohash_7
      END as id,
      COUNT(*) as count,
      ROUND(AVG(price)::numeric, 0) as avg_price,
      AVG(lat)::double precision as lat,
      AVG(lng)::double precision as lng,
      ST_SetSRID(ST_MakePoint(AVG(lng), AVG(lat)), 4326) as geom
    FROM properties
    WHERE status = 'activa'
      AND (v_listing_type IS NULL OR listing_type = v_listing_type)
      AND ST_Intersects(
        ST_SetSRID(ST_MakePoint(lng, lat), 4326),
        ST_Transform(v_bounds, 4326)
      )
    GROUP BY
      CASE v_precision
        WHEN 3 THEN geohash_3
        WHEN 4 THEN geohash_4
        WHEN 5 THEN geohash_5
        WHEN 6 THEN geohash_6
        ELSE geohash_7
      END
  ),
  mvtgeom AS (
    SELECT
      id,
      count,
      avg_price,
      ST_AsMVTGeom(
        ST_Transform(geom, 3857),
        ST_Transform(v_bounds, 3857),
        4096,
        256,
        true
      ) AS geom
    FROM clusters
    WHERE geom IS NOT NULL
  )
  SELECT ST_AsMVT(mvtgeom.*, 'clusters', 4096, 'geom')
  INTO mvt
  FROM mvtgeom;

  RETURN COALESCE(mvt, ''::bytea);
END;
$$ LANGUAGE plpgsql STABLE PARALLEL SAFE;

-- Function to get individual property tiles at high zoom
CREATE OR REPLACE FUNCTION get_property_tiles(
  z integer,
  x integer,
  y integer,
  query_params json DEFAULT '{}'::json
)
RETURNS bytea AS $$
DECLARE
  mvt bytea;
  v_listing_type text;
  v_bounds geometry;
BEGIN
  v_listing_type := query_params->>'listing_type';
  v_bounds := ST_TileEnvelope(z, x, y);

  WITH props AS (
    SELECT
      id::text,
      price,
      listing_type as lt,
      type as pt,
      bedrooms as beds,
      bathrooms as baths,
      geom
    FROM properties
    WHERE status = 'activa'
      AND geom IS NOT NULL
      AND ST_Intersects(geom, ST_Transform(v_bounds, 4326))
      AND (v_listing_type IS NULL OR listing_type = v_listing_type)
    LIMIT 5000
  ),
  mvtgeom AS (
    SELECT
      id,
      price,
      lt,
      pt,
      beds,
      baths,
      ST_AsMVTGeom(
        ST_Transform(geom, 3857),
        ST_Transform(v_bounds, 3857),
        4096,
        64,
        true
      ) AS geom
    FROM props
  )
  SELECT ST_AsMVT(mvtgeom.*, 'properties', 4096, 'geom')
  INTO mvt
  FROM mvtgeom;

  RETURN COALESCE(mvt, ''::bytea);
END;
$$ LANGUAGE plpgsql STABLE PARALLEL SAFE;

-- Comments
COMMENT ON FUNCTION get_geohash_cluster_tiles IS 'Generates MVT tiles for geohash-based clusters';
COMMENT ON FUNCTION get_property_tiles IS 'Generates MVT tiles for individual properties';
