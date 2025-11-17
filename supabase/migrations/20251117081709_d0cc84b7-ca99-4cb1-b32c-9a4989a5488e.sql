-- Limpiar todas las versiones de get_map_tiles y usar versión simple que funciona
DROP FUNCTION IF EXISTS public.get_map_tiles(numeric,numeric,numeric,numeric,integer,text,text,numeric,numeric,integer,integer,text,text);
DROP FUNCTION IF EXISTS public.get_map_tiles(numeric,numeric,numeric,numeric,integer,jsonb);

-- Versión simple y funcional de get_map_tiles
CREATE FUNCTION public.get_map_tiles(
  p_min_lng numeric,
  p_min_lat numeric,
  p_max_lng numeric,
  p_max_lat numeric,
  p_zoom integer,
  p_filters jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  tile_key text,
  zoom integer,
  clusters jsonb,
  properties jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state text := p_filters->>'state';
  v_municipality text := p_filters->>'municipality';
  v_listing_type text := p_filters->>'listingType';
  v_property_type text := p_filters->>'propertyType';
  v_min_price numeric := NULLIF(p_filters->>'minPrice','')::numeric;
  v_max_price numeric := NULLIF(p_filters->>'maxPrice','')::numeric;
  v_min_bedrooms int := NULLIF(p_filters->>'minBedrooms','')::int;
  v_min_bathrooms int := NULLIF(p_filters->>'minBathrooms','')::int;
  v_grid numeric;
  v_props jsonb;
  v_clust jsonb;
BEGIN
  v_grid := CASE WHEN p_zoom >= 14 THEN 0.02 WHEN p_zoom >= 10 THEN 0.1 ELSE 0.25 END;

  IF p_zoom >= 17 THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', p.id, 'title', p.title, 'price', p.price, 'lat', p.lat, 'lng', p.lng,
      'property_type', p.type::text, 'listing_type', p.listing_type,
      'bedrooms', p.bedrooms, 'bathrooms', p.bathrooms, 'parking', p.parking, 'sqft', p.sqft,
      'municipality', p.municipality, 'state', p.state,
      'image_url', (SELECT i.url FROM images i WHERE i.property_id = p.id ORDER BY i.position LIMIT 1),
      'agent_id', p.agent_id, 'is_featured', false, 'created_at', p.created_at
    )), '[]'::jsonb) INTO v_props
    FROM properties p
    WHERE p.lat IS NOT NULL AND p.lng IS NOT NULL AND p.status = 'activa'
      AND p.lat BETWEEN p_min_lat AND p_max_lat AND p.lng BETWEEN p_min_lng AND p_max_lng
      AND (v_state IS NULL OR p.state = v_state)
      AND (v_municipality IS NULL OR p.municipality = v_municipality)
      AND (v_listing_type IS NULL OR p.listing_type = v_listing_type)
      AND (v_property_type IS NULL OR p.type::text = v_property_type)
      AND (v_min_price IS NULL OR p.price >= v_min_price)
      AND (v_max_price IS NULL OR p.price <= v_max_price)
      AND (v_min_bedrooms IS NULL OR p.bedrooms >= v_min_bedrooms)
      AND (v_min_bathrooms IS NULL OR p.bathrooms >= v_min_bathrooms)
    LIMIT 300;
    RETURN QUERY SELECT 'properties'::text, p_zoom, NULL::jsonb, v_props;
  ELSE
    WITH base AS (
      SELECT FLOOR(p.lat/v_grid) lb, FLOOR(p.lng/v_grid) lg, AVG(lat)::numeric lat, AVG(lng)::numeric lng, COUNT(*)::int c, AVG(price)::numeric ap
      FROM properties p
      WHERE p.lat IS NOT NULL AND p.lng IS NOT NULL AND p.status = 'activa'
        AND p.lat BETWEEN p_min_lat AND p_max_lat AND p.lng BETWEEN p_min_lng AND p_max_lng
        AND (v_state IS NULL OR p.state = v_state)
        AND (v_municipality IS NULL OR p.municipality = v_municipality)
        AND (v_listing_type IS NULL OR p.listing_type = v_listing_type)
        AND (v_property_type IS NULL OR p.type::text = v_property_type)
        AND (v_min_price IS NULL OR p.price >= v_min_price)
        AND (v_max_price IS NULL OR p.price <= v_max_price)
        AND (v_min_bedrooms IS NULL OR p.bedrooms >= v_min_bedrooms)
        AND (v_min_bathrooms IS NULL OR p.bathrooms >= v_min_bathrooms)
      GROUP BY lb, lg
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object('lat', ROUND(lat,6), 'lng', ROUND(lng,6), 'count', c, 'avg_price', ROUND(ap,2))), '[]'::jsonb) INTO v_clust FROM base;
    RETURN QUERY SELECT 'clusters'::text, p_zoom, v_clust, NULL::jsonb;
  END IF;
END;
$$;