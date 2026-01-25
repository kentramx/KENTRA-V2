-- ============================================
-- LIMPIEZA DE BASE DE DATOS - MAPAS
-- EJECUTAR EN SUPABASE SQL EDITOR
-- ============================================

-- 1. ELIMINAR TABLA DE CLUSTERS
DROP TABLE IF EXISTS property_clusters CASCADE;

-- 2. ELIMINAR FUNCIONES
DROP FUNCTION IF EXISTS encode_geohash(double precision, double precision, integer) CASCADE;
DROP FUNCTION IF EXISTS update_property_geohash() CASCADE;
DROP FUNCTION IF EXISTS get_clusters_in_viewport CASCADE;
DROP FUNCTION IF EXISTS get_properties_in_viewport CASCADE;
DROP FUNCTION IF EXISTS refresh_property_clusters CASCADE;
DROP FUNCTION IF EXISTS backfill_geohash_batched CASCADE;

-- 3. ELIMINAR TRIGGER
DROP TRIGGER IF EXISTS trigger_update_property_geohash ON properties;

-- 4. ELIMINAR COLUMNAS GEOHASH
ALTER TABLE properties DROP COLUMN IF EXISTS geohash_4;
ALTER TABLE properties DROP COLUMN IF EXISTS geohash_5;
ALTER TABLE properties DROP COLUMN IF EXISTS geohash_6;
ALTER TABLE properties DROP COLUMN IF EXISTS geohash_7;
ALTER TABLE properties DROP COLUMN IF EXISTS geohash_8;

-- 5. ELIMINAR ÍNDICES
DROP INDEX IF EXISTS idx_properties_geohash_4;
DROP INDEX IF EXISTS idx_properties_geohash_5;
DROP INDEX IF EXISTS idx_properties_geohash_6;
DROP INDEX IF EXISTS idx_properties_geohash_7;
DROP INDEX IF EXISTS idx_properties_geohash_8;
DROP INDEX IF EXISTS idx_properties_geohash_4_prefix;
DROP INDEX IF EXISTS idx_properties_geohash_5_prefix;
DROP INDEX IF EXISTS idx_properties_geohash_6_prefix;

-- 6. VERIFICAR LIMPIEZA
SELECT 'Funciones restantes:' as check_type, routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND (routine_name ILIKE '%cluster%' OR routine_name ILIKE '%geohash%');

SELECT 'Columnas geohash restantes:' as check_type, column_name
FROM information_schema.columns
WHERE table_name = 'properties' AND column_name LIKE 'geohash%';

SELECT 'Tablas cluster restantes:' as check_type, table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name ILIKE '%cluster%';

-- Las 3 queries de verificación deben retornar VACÍO
