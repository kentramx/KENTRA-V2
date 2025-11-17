-- Función para obtener el conteo total de propiedades según filtros
CREATE OR REPLACE FUNCTION get_properties_total_count(
  p_state text DEFAULT NULL,
  p_municipality text DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_listing_type text DEFAULT NULL,
  p_price_min numeric DEFAULT NULL,
  p_price_max numeric DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_count integer;
BEGIN
  SELECT COUNT(*)::integer INTO total_count
  FROM properties p
  WHERE p.status = 'activa'
    AND (p_state IS NULL OR p.state = p_state)
    AND (p_municipality IS NULL OR p.municipality = p_municipality)
    AND (p_type IS NULL OR p.type::text = p_type)
    AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
    AND (p_price_min IS NULL OR p.price >= p_price_min)
    AND (p_price_max IS NULL OR p.price <= p_price_max);
    
  RETURN total_count;
END;
$$;

COMMENT ON FUNCTION get_properties_total_count IS 'Get total count of properties matching filters for pagination display';