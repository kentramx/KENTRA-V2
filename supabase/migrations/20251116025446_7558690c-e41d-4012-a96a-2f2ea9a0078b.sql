-- ============================================
-- OPTIMIZACIONES PARA ESCALAR A 1M+ PROPIEDADES
-- ============================================

-- 1. FULL-TEXT SEARCH (FTS)
-- Agregar columna tsvector para búsqueda de texto rápida
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS search_vector tsvector 
GENERATED ALWAYS AS (
  setweight(to_tsvector('spanish', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('spanish', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('spanish', coalesce(address, '')), 'C') ||
  setweight(to_tsvector('spanish', coalesce(municipality, '')), 'D') ||
  setweight(to_tsvector('spanish', coalesce(state, '')), 'D')
) STORED;

-- Crear índice GIN para búsqueda full-text
CREATE INDEX IF NOT EXISTS idx_properties_search_vector 
ON properties USING GIN (search_vector);

-- 2. MATERIALIZED VIEW: Estadísticas por Municipio
CREATE MATERIALIZED VIEW IF NOT EXISTS property_stats_by_municipality AS
SELECT 
  state,
  municipality,
  COUNT(*) as total_properties,
  COUNT(*) FILTER (WHERE status = 'activa') as active_properties,
  AVG(price) FILTER (WHERE status = 'activa') as avg_price,
  MIN(price) FILTER (WHERE status = 'activa') as min_price,
  MAX(price) FILTER (WHERE status = 'activa') as max_price,
  AVG(sqft) FILTER (WHERE status = 'activa' AND sqft IS NOT NULL) as avg_sqft,
  COUNT(DISTINCT agent_id) FILTER (WHERE status = 'activa') as total_agents,
  COUNT(*) FILTER (WHERE for_sale = true AND status = 'activa') as properties_for_sale,
  COUNT(*) FILTER (WHERE for_rent = true AND status = 'activa') as properties_for_rent
FROM properties
GROUP BY state, municipality;

-- Índice único para refresh concurrente
CREATE UNIQUE INDEX IF NOT EXISTS idx_property_stats_municipality 
ON property_stats_by_municipality (state, municipality);

-- 3. MATERIALIZED VIEW: Estadísticas por Estado
CREATE MATERIALIZED VIEW IF NOT EXISTS property_stats_by_state AS
SELECT 
  state,
  COUNT(*) as total_properties,
  COUNT(*) FILTER (WHERE status = 'activa') as active_properties,
  AVG(price) FILTER (WHERE status = 'activa') as avg_price,
  MIN(price) FILTER (WHERE status = 'activa') as min_price,
  MAX(price) FILTER (WHERE status = 'activa') as max_price,
  COUNT(DISTINCT municipality) as total_municipalities,
  COUNT(DISTINCT agent_id) FILTER (WHERE status = 'activa') as total_agents
FROM properties
GROUP BY state;

CREATE UNIQUE INDEX IF NOT EXISTS idx_property_stats_state 
ON property_stats_by_state (state);

-- 4. FUNCIÓN: Búsqueda Full-Text optimizada
CREATE OR REPLACE FUNCTION search_properties_fts(
  search_query TEXT,
  p_state TEXT DEFAULT NULL,
  p_municipality TEXT DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_listing_type TEXT DEFAULT NULL,
  p_price_min NUMERIC DEFAULT NULL,
  p_price_max NUMERIC DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  price NUMERIC,
  type property_type,
  listing_type TEXT,
  address TEXT,
  municipality TEXT,
  state TEXT,
  bedrooms INT,
  bathrooms INT,
  parking INT,
  sqft NUMERIC,
  lat NUMERIC,
  lng NUMERIC,
  agent_id UUID,
  created_at TIMESTAMPTZ,
  rank REAL
) 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.title,
    p.price,
    p.type,
    p.listing_type,
    p.address,
    p.municipality,
    p.state,
    p.bedrooms,
    p.bathrooms,
    p.parking,
    p.sqft,
    p.lat,
    p.lng,
    p.agent_id,
    p.created_at,
    ts_rank(p.search_vector, query) as rank
  FROM properties p,
       plainto_tsquery('spanish', search_query) query
  WHERE p.search_vector @@ query
    AND p.status = 'activa'
    AND (p_state IS NULL OR p.state = p_state)
    AND (p_municipality IS NULL OR p.municipality = p_municipality)
    AND (p_type IS NULL OR p.type::TEXT = p_type)
    AND (p_listing_type IS NULL OR 
         (p_listing_type = 'venta' AND p.for_sale = true) OR
         (p_listing_type = 'renta' AND p.for_rent = true))
    AND (p_price_min IS NULL OR p.price >= p_price_min)
    AND (p_price_max IS NULL OR p.price <= p_price_max)
  ORDER BY rank DESC, p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 5. FUNCIÓN: Obtener estadísticas por municipio (desde materialized view)
CREATE OR REPLACE FUNCTION get_municipality_stats(
  p_state TEXT,
  p_municipality TEXT
)
RETURNS TABLE (
  state TEXT,
  municipality TEXT,
  total_properties BIGINT,
  active_properties BIGINT,
  avg_price NUMERIC,
  min_price NUMERIC,
  max_price NUMERIC,
  avg_sqft NUMERIC,
  total_agents BIGINT,
  properties_for_sale BIGINT,
  properties_for_rent BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    state,
    municipality,
    total_properties,
    active_properties,
    avg_price,
    min_price,
    max_price,
    avg_sqft,
    total_agents,
    properties_for_sale,
    properties_for_rent
  FROM property_stats_by_municipality
  WHERE state = p_state 
    AND municipality = p_municipality;
$$;

-- 6. FUNCIÓN: Obtener estadísticas por estado (desde materialized view)
CREATE OR REPLACE FUNCTION get_state_stats(p_state TEXT)
RETURNS TABLE (
  state TEXT,
  total_properties BIGINT,
  active_properties BIGINT,
  avg_price NUMERIC,
  min_price NUMERIC,
  max_price NUMERIC,
  total_municipalities BIGINT,
  total_agents BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    state,
    total_properties,
    active_properties,
    avg_price,
    min_price,
    max_price,
    total_municipalities,
    total_agents
  FROM property_stats_by_state
  WHERE state = p_state;
$$;

-- 7. ÍNDICES ADICIONALES para queries comunes optimizadas
CREATE INDEX IF NOT EXISTS idx_properties_search_location 
ON properties (state, municipality, status) 
WHERE status = 'activa';

CREATE INDEX IF NOT EXISTS idx_properties_price_range 
ON properties (price, status) 
WHERE status = 'activa' AND price IS NOT NULL;

-- 8. Comentarios para documentación
COMMENT ON COLUMN properties.search_vector IS 'Vector de búsqueda full-text generado automáticamente';
COMMENT ON MATERIALIZED VIEW property_stats_by_municipality IS 'Estadísticas pre-calculadas por municipio - Refresh cada hora';
COMMENT ON MATERIALIZED VIEW property_stats_by_state IS 'Estadísticas pre-calculadas por estado - Refresh cada hora';
COMMENT ON FUNCTION search_properties_fts IS 'Búsqueda full-text optimizada con ranking por relevancia';

-- Nota: Las materialized views deben refrescarse periódicamente
-- Se recomienda configurar un cron job que ejecute:
-- REFRESH MATERIALIZED VIEW CONCURRENTLY property_stats_by_municipality;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY property_stats_by_state;