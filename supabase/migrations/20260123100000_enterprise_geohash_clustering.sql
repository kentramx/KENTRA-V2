-- ============================================================================
-- ENTERPRISE GEOHASH CLUSTERING SYSTEM
-- ============================================================================
-- Implementa clustering jerárquico pre-computado para 1M+ propiedades
-- Compatible con Supabase Free/Pro (sin extensiones especiales)
-- ============================================================================

-- ============================================================================
-- PARTE 1: FUNCIÓN GEOHASH (SQL puro, sin extensiones)
-- ============================================================================

CREATE OR REPLACE FUNCTION encode_geohash(
  latitude double precision,
  longitude double precision,
  precision_level integer DEFAULT 8
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  base32_chars text := '0123456789bcdefghjkmnpqrstuvwxyz';
  geohash text := '';
  lat_min double precision := -90.0;
  lat_max double precision := 90.0;
  lng_min double precision := -180.0;
  lng_max double precision := 180.0;
  lat_mid double precision;
  lng_mid double precision;
  bit integer := 0;
  ch integer := 0;
  is_lng boolean := true;
  i integer;
BEGIN
  IF latitude IS NULL OR longitude IS NULL THEN
    RETURN NULL;
  END IF;

  latitude := GREATEST(-90, LEAST(90, latitude));
  longitude := GREATEST(-180, LEAST(180, longitude));

  FOR i IN 1..(precision_level * 5) LOOP
    IF is_lng THEN
      lng_mid := (lng_min + lng_max) / 2.0;
      IF longitude >= lng_mid THEN
        ch := ch | (1 << (4 - bit));
        lng_min := lng_mid;
      ELSE
        lng_max := lng_mid;
      END IF;
    ELSE
      lat_mid := (lat_min + lat_max) / 2.0;
      IF latitude >= lat_mid THEN
        ch := ch | (1 << (4 - bit));
        lat_min := lat_mid;
      ELSE
        lat_max := lat_mid;
      END IF;
    END IF;

    is_lng := NOT is_lng;

    IF bit < 4 THEN
      bit := bit + 1;
    ELSE
      geohash := geohash || substr(base32_chars, ch + 1, 1);
      bit := 0;
      ch := 0;
    END IF;
  END LOOP;

  RETURN geohash;
END;
$$;

-- ============================================================================
-- PARTE 2: COLUMNAS GEOHASH EN PROPERTIES
-- ============================================================================

ALTER TABLE properties ADD COLUMN IF NOT EXISTS geohash_4 text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS geohash_5 text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS geohash_6 text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS geohash_7 text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS geohash_8 text;

CREATE INDEX IF NOT EXISTS idx_properties_geohash_4 ON properties (geohash_4) WHERE status = 'activa';
CREATE INDEX IF NOT EXISTS idx_properties_geohash_5 ON properties (geohash_5) WHERE status = 'activa';
CREATE INDEX IF NOT EXISTS idx_properties_geohash_6 ON properties (geohash_6) WHERE status = 'activa';
CREATE INDEX IF NOT EXISTS idx_properties_geohash_7 ON properties (geohash_7) WHERE status = 'activa';
CREATE INDEX IF NOT EXISTS idx_properties_geohash_8 ON properties (geohash_8) WHERE status = 'activa';

-- ============================================================================
-- PARTE 3: TRIGGER PARA CALCULAR GEOHASH AUTOMÁTICAMENTE (nuevas props)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_property_geohash()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR
     NEW.lat IS DISTINCT FROM OLD.lat OR
     NEW.lng IS DISTINCT FROM OLD.lng THEN

    IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
      NEW.geohash_4 := encode_geohash(NEW.lat, NEW.lng, 4);
      NEW.geohash_5 := encode_geohash(NEW.lat, NEW.lng, 5);
      NEW.geohash_6 := encode_geohash(NEW.lat, NEW.lng, 6);
      NEW.geohash_7 := encode_geohash(NEW.lat, NEW.lng, 7);
      NEW.geohash_8 := encode_geohash(NEW.lat, NEW.lng, 8);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_property_geohash ON properties;
CREATE TRIGGER trigger_update_property_geohash
  BEFORE INSERT OR UPDATE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION update_property_geohash();

-- ============================================================================
-- PARTE 4: TABLA DE CLUSTERS PRE-COMPUTADOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS property_clusters (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  geohash text NOT NULL,
  zoom_level integer NOT NULL,
  property_count integer NOT NULL DEFAULT 0,
  avg_price numeric(12,2),
  min_price numeric(12,2),
  max_price numeric(12,2),
  center_lat double precision NOT NULL,
  center_lng double precision NOT NULL,
  bounds_north double precision,
  bounds_south double precision,
  bounds_east double precision,
  bounds_west double precision,
  count_sale integer DEFAULT 0,
  count_rent integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_cluster_geohash_zoom UNIQUE (geohash, zoom_level)
);

CREATE INDEX IF NOT EXISTS idx_clusters_zoom_geohash ON property_clusters (zoom_level, geohash);
CREATE INDEX IF NOT EXISTS idx_clusters_geohash_prefix ON property_clusters (geohash text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_clusters_bounds ON property_clusters (bounds_south, bounds_north, bounds_west, bounds_east);

-- ============================================================================
-- PARTE 5: FUNCIÓN PARA REFRESCAR CLUSTERS
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_property_clusters(
  p_zoom_levels integer[] DEFAULT ARRAY[4, 5, 6, 7]
)
RETURNS TABLE(
  zoom_level integer,
  clusters_updated integer,
  duration_ms integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_zoom integer;
  v_geohash_col text;
  v_start_time timestamptz;
  v_count integer;
BEGIN
  FOREACH v_zoom IN ARRAY p_zoom_levels LOOP
    v_start_time := clock_timestamp();

    v_geohash_col := CASE
      WHEN v_zoom <= 6 THEN 'geohash_4'
      WHEN v_zoom <= 9 THEN 'geohash_5'
      WHEN v_zoom <= 12 THEN 'geohash_6'
      WHEN v_zoom <= 15 THEN 'geohash_7'
      ELSE 'geohash_8'
    END;

    EXECUTE format($sql$
      INSERT INTO property_clusters (
        geohash, zoom_level, property_count, avg_price, min_price, max_price,
        center_lat, center_lng, bounds_north, bounds_south, bounds_east, bounds_west,
        count_sale, count_rent, updated_at
      )
      SELECT
        %I as geohash, %s as zoom_level, COUNT(*) as property_count,
        AVG(price) as avg_price, MIN(price) as min_price, MAX(price) as max_price,
        AVG(lat) as center_lat, AVG(lng) as center_lng,
        MAX(lat) as bounds_north, MIN(lat) as bounds_south,
        MAX(lng) as bounds_east, MIN(lng) as bounds_west,
        COUNT(*) FILTER (WHERE for_sale = true) as count_sale,
        COUNT(*) FILTER (WHERE for_rent = true) as count_rent,
        NOW()
      FROM properties
      WHERE status = 'activa' AND %I IS NOT NULL
      GROUP BY %I
      ON CONFLICT (geohash, zoom_level) DO UPDATE SET
        property_count = EXCLUDED.property_count,
        avg_price = EXCLUDED.avg_price,
        min_price = EXCLUDED.min_price,
        max_price = EXCLUDED.max_price,
        center_lat = EXCLUDED.center_lat,
        center_lng = EXCLUDED.center_lng,
        bounds_north = EXCLUDED.bounds_north,
        bounds_south = EXCLUDED.bounds_south,
        bounds_east = EXCLUDED.bounds_east,
        bounds_west = EXCLUDED.bounds_west,
        count_sale = EXCLUDED.count_sale,
        count_rent = EXCLUDED.count_rent,
        updated_at = NOW()
    $sql$, v_geohash_col, v_zoom, v_geohash_col, v_geohash_col);

    GET DIAGNOSTICS v_count = ROW_COUNT;

    zoom_level := v_zoom;
    clusters_updated := v_count;
    duration_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::integer;
    RETURN NEXT;
  END LOOP;

  DELETE FROM property_clusters pc
  WHERE NOT EXISTS (
    SELECT 1 FROM properties p
    WHERE p.status = 'activa'
      AND (p.geohash_4 = pc.geohash OR p.geohash_5 = pc.geohash OR
           p.geohash_6 = pc.geohash OR p.geohash_7 = pc.geohash)
  );
END;
$$;

-- ============================================================================
-- PARTE 6: FUNCIÓN PARA OBTENER CLUSTERS POR VIEWPORT
-- ============================================================================

CREATE OR REPLACE FUNCTION get_clusters_in_viewport(
  p_bounds_north double precision,
  p_bounds_south double precision,
  p_bounds_east double precision,
  p_bounds_west double precision,
  p_zoom integer,
  p_listing_type text DEFAULT NULL,
  p_limit integer DEFAULT 500
)
RETURNS TABLE(
  id text,
  lat double precision,
  lng double precision,
  count integer,
  avg_price numeric,
  is_cluster boolean
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_target_zoom integer;
BEGIN
  v_target_zoom := CASE
    WHEN p_zoom <= 6 THEN 4
    WHEN p_zoom <= 9 THEN 5
    WHEN p_zoom <= 12 THEN 6
    WHEN p_zoom <= 15 THEN 7
    ELSE 8
  END;

  IF p_zoom >= 14 THEN
    RETURN QUERY
    SELECT
      p.id::text,
      p.lat::double precision,
      p.lng::double precision,
      1::integer as count,
      p.price::numeric as avg_price,
      false as is_cluster
    FROM properties p
    WHERE p.status = 'activa'
      AND p.lat BETWEEN p_bounds_south AND p_bounds_north
      AND p.lng BETWEEN p_bounds_west AND p_bounds_east
      AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
    ORDER BY p.is_featured DESC, p.created_at DESC
    LIMIT p_limit;
  ELSE
    RETURN QUERY
    SELECT
      pc.geohash::text as id,
      pc.center_lat as lat,
      pc.center_lng as lng,
      pc.property_count as count,
      pc.avg_price,
      true as is_cluster
    FROM property_clusters pc
    WHERE pc.zoom_level = v_target_zoom
      AND pc.center_lat BETWEEN p_bounds_south AND p_bounds_north
      AND pc.center_lng BETWEEN p_bounds_west AND p_bounds_east
      AND pc.property_count > 0
    ORDER BY pc.property_count DESC
    LIMIT p_limit;
  END IF;
END;
$$;

-- ============================================================================
-- PARTE 7: FUNCIÓN PARA BACKFILL GEOHASH EN BATCHES (evita timeout)
-- ============================================================================

CREATE OR REPLACE FUNCTION backfill_geohash_batched(
  p_batch_size integer DEFAULT 10000
)
RETURNS TABLE(
  batch_number integer,
  rows_updated integer,
  remaining integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_batch integer := 0;
  v_updated integer;
  v_remaining integer;
BEGIN
  LOOP
    v_batch := v_batch + 1;

    WITH batch AS (
      SELECT id
      FROM properties
      WHERE lat IS NOT NULL
        AND lng IS NOT NULL
        AND geohash_4 IS NULL
      LIMIT p_batch_size
    )
    UPDATE properties p
    SET
      geohash_4 = encode_geohash(p.lat, p.lng, 4),
      geohash_5 = encode_geohash(p.lat, p.lng, 5),
      geohash_6 = encode_geohash(p.lat, p.lng, 6),
      geohash_7 = encode_geohash(p.lat, p.lng, 7),
      geohash_8 = encode_geohash(p.lat, p.lng, 8)
    FROM batch
    WHERE p.id = batch.id;

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    SELECT COUNT(*) INTO v_remaining
    FROM properties
    WHERE lat IS NOT NULL AND lng IS NOT NULL AND geohash_4 IS NULL;

    batch_number := v_batch;
    rows_updated := v_updated;
    remaining := v_remaining;
    RETURN NEXT;

    EXIT WHEN v_updated = 0;

    -- Pequeña pausa para no sobrecargar
    PERFORM pg_sleep(0.1);
  END LOOP;
END;
$$;

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

COMMENT ON FUNCTION encode_geohash IS 'Codifica lat/lng a geohash. Precision 4=~40km, 5=~5km, 6=~1km, 7=~150m, 8=~40m';
COMMENT ON TABLE property_clusters IS 'Clusters pre-computados por geohash y zoom level. Refresh cada 5-15 min.';
COMMENT ON FUNCTION refresh_property_clusters IS 'Refresca clusters para los zoom levels especificados. Llamar periódicamente.';
COMMENT ON FUNCTION get_clusters_in_viewport IS 'Obtiene clusters o propiedades según zoom level. Usa clusters pre-computados.';
COMMENT ON FUNCTION backfill_geohash_batched IS 'Actualiza geohash en batches para evitar timeout. Ejecutar manualmente.';
