-- FASE 1: SEGURIDAD - Agregar RLS policies faltantes

-- 1. Policies para phone_verifications (tabla SIN policies)
CREATE POLICY "Users can view their own phone verifications"
ON public.phone_verifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own phone verifications"
ON public.phone_verifications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own phone verifications"
ON public.phone_verifications
FOR UPDATE
USING (auth.uid() = user_id);

-- 2. Crear índice compuesto para búsquedas optimizadas
CREATE INDEX IF NOT EXISTS idx_properties_search_optimized 
ON public.properties (status, state, municipality, type, price, created_at DESC)
WHERE status = 'activa';

-- 3. Índice para cursor-based pagination
CREATE INDEX IF NOT EXISTS idx_properties_cursor_pagination
ON public.properties (created_at DESC, id)
WHERE status = 'activa';

-- 4. Función optimizada para obtener propiedades con cursor
CREATE OR REPLACE FUNCTION get_properties_cursor(
  p_cursor timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_state text DEFAULT NULL,
  p_municipality text DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_listing_type text DEFAULT NULL,
  p_price_min numeric DEFAULT NULL,
  p_price_max numeric DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  title text,
  price numeric,
  bedrooms integer,
  bathrooms integer,
  parking integer,
  lat numeric,
  lng numeric,
  address text,
  state text,
  municipality text,
  type property_type,
  listing_type text,
  created_at timestamptz,
  sqft numeric,
  agent_id uuid,
  for_sale boolean,
  for_rent boolean,
  sale_price numeric,
  rent_price numeric,
  currency text,
  next_cursor timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.title,
    p.price,
    p.bedrooms,
    p.bathrooms,
    p.parking,
    p.lat,
    p.lng,
    p.address,
    p.state,
    p.municipality,
    p.type,
    p.listing_type,
    p.created_at,
    p.sqft,
    p.agent_id,
    p.for_sale,
    p.for_rent,
    p.sale_price,
    p.rent_price,
    p.currency,
    p.created_at as next_cursor
  FROM properties p
  WHERE p.status = 'activa'
    AND (p_cursor IS NULL OR p.created_at < p_cursor)
    AND (p_state IS NULL OR p.state = p_state)
    AND (p_municipality IS NULL OR p.municipality = p_municipality)
    AND (p_type IS NULL OR p.type::text = p_type)
    AND (p_listing_type IS NULL OR 
         (p_listing_type = 'venta' AND p.for_sale = true) OR
         (p_listing_type = 'renta' AND p.for_rent = true))
    AND (p_price_min IS NULL OR p.price >= p_price_min)
    AND (p_price_max IS NULL OR p.price <= p_price_max)
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT p_limit;
END;
$$;

-- 5. Función para batch loading de imágenes (optimización N+1)
CREATE OR REPLACE FUNCTION get_images_batch(property_ids uuid[])
RETURNS TABLE(
  property_id uuid,
  images jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.property_id,
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'url', i.url,
        'position', i.position
      ) ORDER BY i.position
    ) as images
  FROM images i
  WHERE i.property_id = ANY(property_ids)
  GROUP BY i.property_id;
END;
$$;

COMMENT ON FUNCTION get_properties_cursor IS 'Optimized cursor-based pagination for properties';
COMMENT ON FUNCTION get_images_batch IS 'Batch load images for multiple properties to avoid N+1 queries';
