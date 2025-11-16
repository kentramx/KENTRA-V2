
-- Crear 10,000 propiedades demo distribuidas entre los 100 agentes
-- Distribución: 60% venta, 30% renta, 10% ambos
-- Monedas: 90% MXN, 10% USD
DO $$
DECLARE
  v_property_types TEXT[] := ARRAY['casa', 'departamento', 'terreno', 'local_comercial', 'oficina'];
  v_municipalities TEXT[] := ARRAY['Benito Juárez', 'Miguel Hidalgo', 'Tlalpan', 'Guadalajara', 'Zapopan',
    'Monterrey', 'San Pedro Garza García', 'Cancún', 'Solidaridad', 'Puerto Vallarta'];
  v_states TEXT[] := ARRAY['Ciudad de México', 'Ciudad de México', 'Ciudad de México', 'Jalisco', 'Jalisco',
    'Nuevo León', 'Nuevo León', 'Quintana Roo', 'Quintana Roo', 'Jalisco'];
  v_colonias TEXT[] := ARRAY['Centro', 'Roma Norte', 'Condesa', 'Polanco', 'Del Valle',
    'Narvarte', 'Coyoacán Centro', 'Santa Fe', 'Chapultepec', 'Lomas'];
  
  v_agent_id UUID;
  v_property_type TEXT;
  v_municipality TEXT;
  v_state TEXT;
  v_colonia TEXT;
  v_for_sale BOOLEAN;
  v_for_rent BOOLEAN;
  v_currency TEXT;
  v_price NUMERIC;
  v_listing_distribution INTEGER;
  v_location_idx INTEGER;
  v_colonia_idx INTEGER;
  
  i INTEGER;
  agent_idx INTEGER;
BEGIN
  FOR i IN 1..10000 LOOP
    -- Distribuir propiedades entre los 100 agentes
    agent_idx := ((i - 1) % 100) + 1;
    v_agent_id := ('00000000-0000-0000-0000-' || LPAD(agent_idx::TEXT, 12, '0'))::UUID;
    
    -- Tipo de propiedad aleatorio
    v_property_type := v_property_types[((i * 7) % 5) + 1];
    
    -- Ubicación basada en el índice
    v_location_idx := ((i * 3) % 10) + 1;
    v_municipality := v_municipalities[v_location_idx];
    v_state := v_states[v_location_idx];
    v_colonia_idx := ((i * 5) % 10) + 1;
    v_colonia := v_colonias[v_colonia_idx];
    
    -- Distribución de listados: 60% venta, 30% renta, 10% ambos
    v_listing_distribution := i % 10;
    IF v_listing_distribution < 6 THEN
      v_for_sale := true;
      v_for_rent := false;
    ELSIF v_listing_distribution < 9 THEN
      v_for_sale := false;
      v_for_rent := true;
    ELSE
      v_for_sale := true;
      v_for_rent := true;
    END IF;
    
    -- Moneda: 90% MXN, 10% USD
    IF (i % 10) = 0 THEN
      v_currency := 'USD';
      v_price := 100000 + ((i * 137) % 900000);
    ELSE
      v_currency := 'MXN';
      v_price := 1500000 + ((i * 193) % 8500000);
    END IF;
    
    -- Insertar propiedad
    INSERT INTO properties (
      agent_id,
      type,
      title,
      address,
      colonia,
      municipality,
      state,
      price,
      currency,
      for_sale,
      for_rent,
      sale_price,
      rent_price,
      bedrooms,
      bathrooms,
      sqft,
      status,
      description,
      listing_type,
      created_at
    ) VALUES (
      v_agent_id,
      v_property_type::property_type,
      v_property_type || ' en ' || v_colonia,
      'Calle ' || ((i % 50) + 1)::TEXT || ' #' || ((i % 200) + 1)::TEXT,
      v_colonia,
      v_municipality,
      v_state,
      v_price,
      v_currency,
      v_for_sale,
      v_for_rent,
      CASE WHEN v_for_sale THEN v_price ELSE NULL END,
      CASE WHEN v_for_rent THEN v_price * 0.01 ELSE NULL END,
      2 + ((i * 7) % 4),
      1 + ((i * 5) % 3),
      80 + ((i * 11) % 220),
      'activa',
      'Excelente propiedad ubicada en una zona estratégica con acceso a servicios y transporte. Ideal para familias o inversión.',
      CASE 
        WHEN v_for_sale THEN 'venta'
        ELSE 'renta'
      END,
      NOW() - (INTERVAL '1 day' * ((i * 13) % 365))
    );
    
  END LOOP;
END $$;
