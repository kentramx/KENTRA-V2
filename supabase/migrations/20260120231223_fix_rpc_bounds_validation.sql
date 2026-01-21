-- ============================================================================
-- FIX: RPC bounds validation
-- ============================================================================
-- The RPCs were only checking if p_bounds_north IS NULL to decide whether
-- to apply spatial filtering. But if ANY of the four bounds values is null,
-- ST_MakeEnvelope fails silently and returns no results.
--
-- Fix: Check ALL four bounds values before applying spatial filter.
-- ============================================================================

-- 1. Fix get_properties_in_viewport
CREATE OR REPLACE FUNCTION get_properties_in_viewport(
  bounds_north float,
  bounds_south float,
  bounds_east float,
  bounds_west float,
  p_status text DEFAULT 'activa',
  p_listing_type text DEFAULT NULL,
  p_property_type text DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_min_bedrooms int DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_municipality text DEFAULT NULL,
  p_limit int DEFAULT 10000
)
RETURNS TABLE (
  id uuid,
  lat float,
  lng float,
  price numeric,
  currency text,
  title text,
  type text,
  listing_type text,
  address text,
  colonia text,
  municipality text,
  state text,
  bedrooms int,
  bathrooms numeric,
  parking int,
  sqft numeric,
  for_sale boolean,
  for_rent boolean,
  sale_price numeric,
  rent_price numeric,
  agent_id uuid,
  is_featured boolean,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.lat::float,
    p.lng::float,
    p.price,
    p.currency,
    p.title,
    p.type::text,
    p.listing_type,
    p.address,
    p.colonia,
    p.municipality,
    p.state,
    p.bedrooms,
    p.bathrooms,
    p.parking,
    p.sqft,
    p.for_sale,
    p.for_rent,
    p.sale_price,
    p.rent_price,
    p.agent_id,
    p.is_featured,
    p.created_at
  FROM properties p
  WHERE p.status::text = p_status
    -- FIX: Check ALL bounds are present before applying spatial filter
    AND (
      (bounds_north IS NULL OR bounds_south IS NULL OR bounds_east IS NULL OR bounds_west IS NULL)
      OR p.geom && ST_MakeEnvelope(bounds_west, bounds_south, bounds_east, bounds_north, 4326)
    )
    AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
    AND (p_property_type IS NULL OR p.type::text = p_property_type)
    AND (p_min_price IS NULL OR p.price >= p_min_price)
    AND (p_max_price IS NULL OR p.price <= p_max_price)
    AND (p_min_bedrooms IS NULL OR p.bedrooms >= p_min_bedrooms)
    AND (p_state IS NULL OR p.state = p_state)
    AND (p_municipality IS NULL OR p.municipality = p_municipality)
  ORDER BY p.is_featured DESC, p.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Fix search_properties
CREATE OR REPLACE FUNCTION search_properties(
  p_status text DEFAULT 'activa',
  p_listing_type text DEFAULT NULL,
  p_property_type text DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_min_bedrooms int DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_municipality text DEFAULT NULL,
  p_bounds_north float DEFAULT NULL,
  p_bounds_south float DEFAULT NULL,
  p_bounds_east float DEFAULT NULL,
  p_bounds_west float DEFAULT NULL,
  p_sort text DEFAULT 'newest',
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  properties jsonb,
  total_count bigint
) AS $$
DECLARE
  v_properties jsonb;
  v_total bigint;
  v_has_valid_bounds boolean;
BEGIN
  -- Check if ALL bounds are provided
  v_has_valid_bounds := (
    p_bounds_north IS NOT NULL AND
    p_bounds_south IS NOT NULL AND
    p_bounds_east IS NOT NULL AND
    p_bounds_west IS NOT NULL
  );

  SELECT COUNT(*) INTO v_total
  FROM properties p
  WHERE p.status::text = p_status
    AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
    AND (p_property_type IS NULL OR p.type::text = p_property_type)
    AND (p_min_price IS NULL OR p.price >= p_min_price)
    AND (p_max_price IS NULL OR p.price <= p_max_price)
    AND (p_min_bedrooms IS NULL OR p.bedrooms >= p_min_bedrooms)
    AND (p_state IS NULL OR p.state = p_state)
    AND (p_municipality IS NULL OR p.municipality = p_municipality)
    -- FIX: Only apply spatial filter if ALL bounds are present
    AND (NOT v_has_valid_bounds OR p.geom && ST_MakeEnvelope(p_bounds_west, p_bounds_south, p_bounds_east, p_bounds_north, 4326));

  SELECT jsonb_agg(row_to_json(t))
  INTO v_properties
  FROM (
    SELECT
      p.id,
      p.lat,
      p.lng,
      p.price,
      p.currency,
      p.title,
      p.type::text,
      p.listing_type,
      p.address,
      p.colonia,
      p.municipality,
      p.state,
      p.bedrooms,
      p.bathrooms,
      p.parking,
      p.sqft,
      p.for_sale,
      p.for_rent,
      p.sale_price,
      p.rent_price,
      p.agent_id,
      p.is_featured,
      p.created_at
    FROM properties p
    WHERE p.status::text = p_status
      AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
      AND (p_property_type IS NULL OR p.type::text = p_property_type)
      AND (p_min_price IS NULL OR p.price >= p_min_price)
      AND (p_max_price IS NULL OR p.price <= p_max_price)
      AND (p_min_bedrooms IS NULL OR p.bedrooms >= p_min_bedrooms)
      AND (p_state IS NULL OR p.state = p_state)
      AND (p_municipality IS NULL OR p.municipality = p_municipality)
      -- FIX: Only apply spatial filter if ALL bounds are present
      AND (NOT v_has_valid_bounds OR p.geom && ST_MakeEnvelope(p_bounds_west, p_bounds_south, p_bounds_east, p_bounds_north, 4326))
    ORDER BY
      CASE WHEN p_sort = 'newest' THEN p.created_at END DESC,
      CASE WHEN p_sort = 'oldest' THEN p.created_at END ASC,
      CASE WHEN p_sort = 'price_asc' THEN p.price END ASC,
      CASE WHEN p_sort = 'price_desc' THEN p.price END DESC,
      p.is_featured DESC
    LIMIT p_limit
    OFFSET p_offset
  ) t;

  RETURN QUERY SELECT COALESCE(v_properties, '[]'::jsonb), v_total;
END;
$$ LANGUAGE plpgsql STABLE;
