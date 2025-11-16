-- ============================================================================
-- SEED PROPERTIES - Generar 10,000 propiedades demo
-- ============================================================================
-- Este script genera 10,000 propiedades con:
-- - Distribución: 60% venta, 30% renta, 10% ambos (venta O renta)
-- - Moneda: 10% USD, 90% MXN
-- - 3-6 imágenes de Unsplash por propiedad
-- - Datos realistas de ubicación, precios y características
-- - Asignadas a agentes demo creados previamente
-- ============================================================================

DO $$
DECLARE
  -- Arrays de datos para variabilidad
  estados text[] := ARRAY[
    'Ciudad de México', 'Jalisco', 'Nuevo León', 'Quintana Roo', 'Guanajuato',
    'Puebla', 'Querétaro', 'Yucatán', 'Baja California', 'Chihuahua',
    'Veracruz', 'Coahuila', 'Michoacán', 'Oaxaca', 'Tamaulipas',
    'San Luis Potosí', 'Sinaloa', 'Chiapas', 'Sonora', 'Morelos'
  ];
  
  municipios_cdmx text[] := ARRAY[
    'Miguel Hidalgo', 'Benito Juárez', 'Coyoacán', 'Cuauhtémoc', 'Álvaro Obregón',
    'Tlalpan', 'Iztapalapa', 'Gustavo A. Madero', 'Azcapotzalco', 'Xochimilco'
  ];
  
  colonias_cdmx text[] := ARRAY[
    'Polanco', 'Roma Norte', 'Condesa', 'Santa Fe', 'Del Valle',
    'Nápoles', 'Juárez', 'Centro Histórico', 'San Ángel', 'Coyoacán Centro',
    'Lindavista', 'Narvarte', 'Insurgentes', 'Anzures', 'Lomas de Chapultepec'
  ];
  
  colonias_genericas text[] := ARRAY[
    'Centro', 'San José', 'Las Flores', 'Jardines', 'Residencial',
    'La Paz', 'Hidalgo', 'Reforma', 'Colonial', 'Los Pinos',
    'Vista Hermosa', 'Santa María', 'El Mirador', 'Las Palmas', 'Insurgentes'
  ];
  
  tipos_propiedad text[] := ARRAY[
    'casa', 'departamento', 'terreno', 'oficina', 'local',
    'bodega', 'rancho', 'penthouse', 'loft', 'estudio'
  ];
  
  -- Variables para el loop
  agente_ids uuid[];
  current_agent_id uuid;
  i int;
  j int;
  rand_percent int;
  tipo_prop text;
  estado text;
  municipio text;
  colonia text;
  for_sale_flag boolean;
  for_rent_flag boolean;
  listing_type_val text;
  currency_val text;
  sale_price_val numeric;
  rent_price_val numeric;
  price_val numeric;
  base_price numeric;
  base_lat numeric;
  base_lng numeric;
  new_property_id uuid;
  num_images int;
  
BEGIN
  -- Obtener los IDs de todos los agentes demo
  SELECT array_agg(id) INTO agente_ids
  FROM auth.users 
  WHERE email LIKE '%@demo.kentra.com.mx';
  
  IF agente_ids IS NULL OR array_length(agente_ids, 1) = 0 THEN
    RAISE EXCEPTION 'No se encontraron agentes demo. Ejecuta seed-demo-agents.sql primero.';
  END IF;
  
  RAISE NOTICE 'Iniciando generación de 10,000 propiedades...';
  RAISE NOTICE 'Agentes demo encontrados: %', array_length(agente_ids, 1);
  
  -- Insertar 10,000 propiedades
  FOR i IN 1..10000 LOOP
    -- Selección aleatoria de agente
    current_agent_id := agente_ids[1 + floor(random() * array_length(agente_ids, 1))];
    
    -- Selección aleatoria de tipo de propiedad (distribución ponderada)
    rand_percent := (random() * 100)::int;
    tipo_prop := CASE 
      WHEN rand_percent < 30 THEN 'casa'
      WHEN rand_percent < 55 THEN 'departamento'
      WHEN rand_percent < 70 THEN 'terreno'
      WHEN rand_percent < 80 THEN 'oficina'
      WHEN rand_percent < 85 THEN 'local'
      WHEN rand_percent < 90 THEN 'bodega'
      WHEN rand_percent < 93 THEN 'rancho'
      WHEN rand_percent < 96 THEN 'penthouse'
      WHEN rand_percent < 98 THEN 'loft'
      ELSE 'estudio'
    END;
    
    -- Selección de ubicación (priorizar CDMX 15%, GDL 10%, MTY 10%)
    rand_percent := (random() * 100)::int;
    IF rand_percent < 15 THEN
      -- 15% Ciudad de México
      estado := 'Ciudad de México';
      municipio := municipios_cdmx[1 + floor(random() * array_length(municipios_cdmx, 1))];
      colonia := colonias_cdmx[1 + floor(random() * array_length(colonias_cdmx, 1))];
      base_lat := 19.4326;
      base_lng := -99.1332;
    ELSIF rand_percent < 25 THEN
      -- 10% Guadalajara
      estado := 'Jalisco';
      municipio := (ARRAY['Guadalajara', 'Zapopan', 'Tlaquepaque', 'Tonalá'])[1 + floor(random() * 4)];
      colonia := colonias_genericas[1 + floor(random() * array_length(colonias_genericas, 1))];
      base_lat := 20.6597;
      base_lng := -103.3496;
    ELSIF rand_percent < 35 THEN
      -- 10% Monterrey
      estado := 'Nuevo León';
      municipio := (ARRAY['Monterrey', 'San Pedro Garza García', 'Guadalupe', 'San Nicolás'])[1 + floor(random() * 4)];
      colonia := colonias_genericas[1 + floor(random() * array_length(colonias_genericas, 1))];
      base_lat := 25.6866;
      base_lng := -100.3161;
    ELSE
      -- 65% Resto del país
      estado := estados[1 + floor(random() * array_length(estados, 1))];
      municipio := 'Municipio ' || (1 + floor(random() * 20))::text;
      colonia := colonias_genericas[1 + floor(random() * array_length(colonias_genericas, 1))];
      base_lat := 19.0 + (random() * 12);
      base_lng := -87.0 - (random() * 30);
    END IF;
    
    -- Determinar listing type (60% venta, 30% renta, 10% ambos)
    rand_percent := (random() * 100)::int;
    IF rand_percent < 60 THEN
      -- 60% Venta solamente
      for_sale_flag := true;
      for_rent_flag := false;
      listing_type_val := 'venta';
    ELSIF rand_percent < 90 THEN
      -- 30% Renta solamente
      for_sale_flag := false;
      for_rent_flag := true;
      listing_type_val := 'renta';
    ELSE
      -- 10% Ambos (venta O renta)
      for_sale_flag := true;
      for_rent_flag := true;
      listing_type_val := 'venta';
    END IF;
    
    -- Determinar moneda (10% USD, 90% MXN)
    IF (i % 10) = 0 THEN
      currency_val := 'USD';
    ELSE
      currency_val := 'MXN';
    END IF;
    
    -- Calcular precio base según tipo y ubicación
    base_price := CASE 
      WHEN tipo_prop = 'casa' THEN 2000000 + (random() * 8000000)
      WHEN tipo_prop = 'departamento' THEN 1500000 + (random() * 6000000)
      WHEN tipo_prop = 'terreno' THEN 500000 + (random() * 5000000)
      WHEN tipo_prop = 'penthouse' THEN 5000000 + (random() * 15000000)
      WHEN tipo_prop = 'oficina' THEN 1000000 + (random() * 4000000)
      WHEN tipo_prop = 'local' THEN 800000 + (random() * 3000000)
      WHEN tipo_prop = 'bodega' THEN 1500000 + (random() * 5000000)
      WHEN tipo_prop = 'rancho' THEN 3000000 + (random() * 20000000)
      WHEN tipo_prop = 'loft' THEN 2000000 + (random() * 5000000)
      ELSE 1000000 + (random() * 3000000) -- estudio
    END;
    
    -- Ajustar precio por zona (CDMX +50%, GDL y MTY +30%)
    IF estado = 'Ciudad de México' THEN
      base_price := base_price * 1.5;
    ELSIF estado IN ('Jalisco', 'Nuevo León') THEN
      base_price := base_price * 1.3;
    END IF;
    
    -- Calcular precios de venta y renta
    IF for_sale_flag THEN
      IF currency_val = 'USD' THEN
        sale_price_val := round(base_price / 17.2, 2);
      ELSE
        sale_price_val := round(base_price, 2);
      END IF;
    ELSE
      sale_price_val := NULL;
    END IF;
    
    IF for_rent_flag THEN
      -- Precio de renta es aproximadamente 0.6% del precio de venta mensual
      IF currency_val = 'USD' THEN
        rent_price_val := round((base_price * 0.006) / 17.2, 2);
      ELSE
        rent_price_val := round(base_price * 0.006, 2);
      END IF;
    ELSE
      rent_price_val := NULL;
    END IF;
    
    -- El campo price es el precio principal según listing_type
    IF listing_type_val = 'venta' THEN
      price_val := sale_price_val;
    ELSE
      price_val := rent_price_val;
    END IF;
    
    -- Insertar propiedad
    INSERT INTO public.properties (
      title,
      type,
      price,
      sale_price,
      rent_price,
      for_sale,
      for_rent,
      listing_type,
      currency,
      address,
      state,
      municipality,
      colonia,
      description,
      bedrooms,
      bathrooms,
      sqft,
      parking,
      lat,
      lng,
      agent_id,
      status,
      created_at,
      updated_at
    ) VALUES (
      initcap(tipo_prop) || ' en ' || colonia,
      tipo_prop::property_type,
      price_val,
      sale_price_val,
      rent_price_val,
      for_sale_flag,
      for_rent_flag,
      listing_type_val,
      currency_val,
      'Calle ' || (1 + (i % 100))::text || ' #' || (100 + (i % 500))::text,
      estado,
      municipio,
      colonia,
      'Hermosa propiedad ubicada en ' || colonia || ', ' || municipio || '. ' ||
      'Cuenta con excelentes acabados y una ubicación privilegiada en una de las mejores zonas. ' ||
      'Ideal para familias o inversionistas que buscan calidad y plusvalía. ' ||
      'La zona cuenta con todos los servicios: transporte, comercios, escuelas y centros de salud. ' ||
      'Excelente inversión en ' || estado || ' con gran potencial de valorización. ' ||
      'No pierdas esta oportunidad única en el mercado inmobiliario.',
      -- Bedrooms
      CASE 
        WHEN tipo_prop IN ('casa', 'departamento', 'penthouse', 'loft') THEN 2 + (i % 4)
        ELSE NULL
      END,
      -- Bathrooms
      CASE 
        WHEN tipo_prop IN ('casa', 'departamento', 'penthouse', 'loft') THEN 1 + (i % 3)
        ELSE NULL
      END,
      -- Sqft
      CASE 
        WHEN tipo_prop = 'casa' THEN 100 + (i % 400)
        WHEN tipo_prop = 'departamento' THEN 50 + (i % 200)
        WHEN tipo_prop = 'terreno' THEN 200 + (i % 1000)
        WHEN tipo_prop = 'oficina' THEN 40 + (i % 300)
        WHEN tipo_prop = 'local' THEN 30 + (i % 200)
        WHEN tipo_prop = 'bodega' THEN 100 + (i % 500)
        WHEN tipo_prop = 'rancho' THEN 1000 + (i % 50000)
        WHEN tipo_prop = 'penthouse' THEN 150 + (i % 350)
        WHEN tipo_prop = 'loft' THEN 60 + (i % 140)
        ELSE 30 + (i % 70) -- estudio
      END,
      -- Parking
      CASE 
        WHEN tipo_prop IN ('casa', 'departamento', 'oficina', 'penthouse', 'loft') THEN 1 + (i % 3)
        ELSE NULL
      END,
      -- Lat (coordenadas con variación)
      base_lat + ((random() * 0.5) - 0.25),
      -- Lng
      base_lng + ((random() * 0.5) - 0.25),
      current_agent_id,
      'activa'::property_status,
      now() - (random() * interval '90 days'), -- Creadas en los últimos 90 días
      now()
    )
    RETURNING id INTO new_property_id;
    
    -- Insertar imágenes (3-6 por propiedad)
    num_images := 3 + floor(random() * 4)::int;
    FOR j IN 0..(num_images - 1) LOOP
      INSERT INTO public.images (property_id, url, position)
      VALUES (
        new_property_id,
        -- URLs de Unsplash categorizadas por tipo
        CASE 
          WHEN tipo_prop = 'casa' THEN 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80&sig=' || (i * 10 + j)::text
          WHEN tipo_prop = 'departamento' THEN 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80&sig=' || (i * 10 + j)::text
          WHEN tipo_prop = 'terreno' THEN 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80&sig=' || (i * 10 + j)::text
          WHEN tipo_prop = 'oficina' THEN 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80&sig=' || (i * 10 + j)::text
          WHEN tipo_prop = 'local' THEN 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80&sig=' || (i * 10 + j)::text
          WHEN tipo_prop = 'bodega' THEN 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&q=80&sig=' || (i * 10 + j)::text
          WHEN tipo_prop = 'rancho' THEN 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80&sig=' || (i * 10 + j)::text
          WHEN tipo_prop = 'penthouse' THEN 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80&sig=' || (i * 10 + j)::text
          WHEN tipo_prop = 'loft' THEN 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80&sig=' || (i * 10 + j)::text
          ELSE 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80&sig=' || (i * 10 + j)::text
        END,
        j
      );
    END LOOP;
    
    -- Log de progreso cada 1000 propiedades
    IF i % 1000 = 0 THEN
      RAISE NOTICE '  Insertadas % propiedades...', i;
    END IF;
    
  END LOOP;
  
  -- Mensaje de confirmación final
  RAISE NOTICE '';
  RAISE NOTICE '✅ Generación completada exitosamente!';
  RAISE NOTICE '   - 10,000 propiedades creadas';
  RAISE NOTICE '   - Distribución: ~60%% venta, ~30%% renta, ~10%% ambos';
  RAISE NOTICE '   - Moneda: ~10%% USD, ~90%% MXN';
  RAISE NOTICE '   - ~40,000-60,000 imágenes de Unsplash insertadas';
  RAISE NOTICE '   - Asignadas a % agentes demo', array_length(agente_ids, 1);
  RAISE NOTICE '   - Todas las propiedades tienen status "activa"';
END $$;
