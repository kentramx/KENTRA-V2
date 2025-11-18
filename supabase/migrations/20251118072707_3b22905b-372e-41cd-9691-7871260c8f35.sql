-- =====================================================
-- OPTIMIZACIÓN GEOESPACIAL: Índice BRIN en (lat, lng)
-- =====================================================
-- Este índice optimiza las búsquedas de rango en coordenadas
-- utilizadas por get_map_tiles para escalar a millones de propiedades.

-- Crear índice BRIN compuesto en (lat, lng)
CREATE INDEX IF NOT EXISTS idx_properties_lat_lng_brin 
ON public.properties 
USING BRIN (lat, lng)
WITH (pages_per_range = 128);

-- Actualizar estadísticas para que Postgres use el índice correctamente
ANALYZE public.properties;