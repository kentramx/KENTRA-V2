-- ============================================================================
-- COMPLETE GEOHASH BACKFILL
-- Ejecutar en: https://supabase.com/dashboard/project/rxtmnbcewprzfgkvehsq/sql/new
-- ============================================================================
--
-- INSTRUCCIONES:
-- 1. Este script actualiza 10,000 propiedades a la vez
-- 2. Ejecutarlo MULTIPLES VECES hasta que "remaining" sea 0
-- 3. Cada ejecución toma ~30-60 segundos
-- 4. Necesitas ejecutarlo ~70 veces para completar las ~700K propiedades restantes
--
-- ============================================================================

-- PASO 1: Ver cuántas propiedades faltan
SELECT
  COUNT(*) FILTER (WHERE geohash_4 IS NULL AND lat IS NOT NULL) as pending,
  COUNT(*) FILTER (WHERE geohash_4 IS NOT NULL) as completed,
  COUNT(*) as total
FROM properties;

-- PASO 2: Ejecutar backfill de un batch (10,000 propiedades)
-- Copiar y ejecutar SOLO esta sección, repetir hasta que remaining = 0
WITH batch AS (
  SELECT id
  FROM properties
  WHERE lat IS NOT NULL
    AND lng IS NOT NULL
    AND geohash_4 IS NULL
  LIMIT 10000
)
UPDATE properties p SET
  geohash_4 = encode_geohash(p.lat, p.lng, 4),
  geohash_5 = encode_geohash(p.lat, p.lng, 5),
  geohash_6 = encode_geohash(p.lat, p.lng, 6),
  geohash_7 = encode_geohash(p.lat, p.lng, 7),
  geohash_8 = encode_geohash(p.lat, p.lng, 8)
FROM batch
WHERE p.id = batch.id;

-- PASO 3: Verificar progreso (ejecutar después de cada batch)
SELECT
  COUNT(*) FILTER (WHERE geohash_4 IS NULL AND lat IS NOT NULL) as remaining,
  COUNT(*) FILTER (WHERE geohash_4 IS NOT NULL) as completed,
  ROUND(COUNT(*) FILTER (WHERE geohash_4 IS NOT NULL)::numeric / COUNT(*)::numeric * 100, 1) as percent_complete
FROM properties;

-- ============================================================================
-- PASO 4: Después de completar el backfill, regenerar clusters
-- ============================================================================

-- Regenerar clusters para todos los zoom levels
SELECT * FROM refresh_property_clusters(ARRAY[4, 5, 6, 7]);

-- Verificar clusters generados
SELECT
  zoom_level,
  COUNT(*) as clusters,
  SUM(property_count) as total_props
FROM property_clusters
GROUP BY zoom_level
ORDER BY zoom_level;
