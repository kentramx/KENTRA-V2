-- ✅ FASE 1: Modificar get_properties_in_viewport para aceptar parámetro p_limit
-- Esta optimización permite limitar el número de propiedades devueltas desde el backend
-- reduciendo la transferencia de datos innecesaria según el nivel de zoom

CREATE OR REPLACE FUNCTION get_properties_in_viewport(
  min_lng NUMERIC,
  min_lat NUMERIC,
  max_lng NUMERIC,
  max_lat NUMERIC,
  p_status TEXT DEFAULT 'activa',
  p_state TEXT DEFAULT NULL,
  p_municipality TEXT DEFAULT NULL,
  p_type property_type DEFAULT NULL,
  p_listing_type TEXT DEFAULT NULL,
  p_price_min NUMERIC DEFAULT NULL,
  p_price_max NUMERIC DEFAULT NULL,
  p_bedrooms INTEGER DEFAULT NULL,
  p_bathrooms INTEGER DEFAULT NULL,
  p_limit INTEGER DEFAULT 500  -- ✅ NUEVO: Parámetro de límite con default 500
)
RETURNS TABLE(
  id UUID,
  title TEXT,
  price NUMERIC,
  currency TEXT,
  lat NUMERIC,
  lng NUMERIC,
  type property_type,
  listing_type TEXT,
  bedrooms INTEGER,
  bathrooms INTEGER,
  parking INTEGER,
  sqft NUMERIC,
  address TEXT,
  state TEXT,
  municipality TEXT,
  agent_id UUID,
  status property_status,
  created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.title,
    p.price,
    p.currency,
    p.lat,
    p.lng,
    p.type,
    p.listing_type,
    p.bedrooms,
    p.bathrooms,
    p.parking,
    p.sqft,
    p.address,
    p.state,
    p.municipality,
    p.agent_id,
    p.status,
    p.created_at
  FROM properties p
  WHERE 
    p.status = p_status::property_status
    AND p.lat IS NOT NULL 
    AND p.lng IS NOT NULL
    AND p.lng >= min_lng 
    AND p.lng <= max_lng
    AND p.lat >= min_lat 
    AND p.lat <= max_lat
    AND (p_state IS NULL OR p.state = p_state)
    AND (p_municipality IS NULL OR p.municipality = p_municipality)
    AND (p_type IS NULL OR p.type = p_type)
    AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
    AND (p_price_min IS NULL OR p.price >= p_price_min)
    AND (p_price_max IS NULL OR p.price <= p_price_max)
    AND (p_bedrooms IS NULL OR p.bedrooms >= p_bedrooms)
    AND (p_bathrooms IS NULL OR p.bathrooms >= p_bathrooms)
  ORDER BY 
    p.created_at DESC
  LIMIT p_limit;  -- ✅ Aplicar límite en la query
END;
$$;