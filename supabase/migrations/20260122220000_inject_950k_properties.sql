-- ============================================================================
-- LOAD TEST: Inject 950,000 properties for 1M scale testing
-- ============================================================================
-- WARNING: This is a load test migration. Run only in staging/test environments.
-- Estimated time: 10-30 minutes depending on database size
-- ============================================================================

-- Create function to generate test properties in batches
CREATE OR REPLACE FUNCTION generate_test_properties(
  p_total_count int DEFAULT 950000,
  p_batch_size int DEFAULT 5000
)
RETURNS jsonb AS $$
DECLARE
  v_inserted int := 0;
  v_batch int := 0;
  v_start_time timestamptz := clock_timestamp();
  v_batch_start timestamptz;
  v_states text[] := ARRAY['Jalisco', 'Nuevo León', 'Ciudad de México', 'Estado de México', 'Querétaro', 'Puebla', 'Guanajuato', 'Yucatán', 'Quintana Roo', 'Baja California'];
  v_municipalities text[][] := ARRAY[
    ARRAY['Guadalajara', 'Zapopan', 'Tlaquepaque', 'Tonalá', 'Tlajomulco'],
    ARRAY['Monterrey', 'San Pedro Garza García', 'San Nicolás', 'Apodaca', 'Escobedo'],
    ARRAY['Benito Juárez', 'Miguel Hidalgo', 'Coyoacán', 'Cuauhtémoc', 'Álvaro Obregón'],
    ARRAY['Naucalpan', 'Tlalnepantla', 'Ecatepec', 'Huixquilucan', 'Metepec'],
    ARRAY['Querétaro', 'Corregidora', 'El Marqués', 'San Juan del Río', 'Tequisquiapan'],
    ARRAY['Puebla', 'San Andrés Cholula', 'San Pedro Cholula', 'Cuautlancingo', 'Atlixco'],
    ARRAY['León', 'Guanajuato', 'Irapuato', 'Celaya', 'San Miguel de Allende'],
    ARRAY['Mérida', 'Progreso', 'Kanasín', 'Umán', 'Conkal'],
    ARRAY['Cancún', 'Playa del Carmen', 'Tulum', 'Cozumel', 'Puerto Morelos'],
    ARRAY['Tijuana', 'Mexicali', 'Ensenada', 'Rosarito', 'Tecate']
  ];
  v_colonias text[] := ARRAY['Centro', 'Del Valle', 'Polanco', 'Roma Norte', 'Condesa', 'Lomas', 'Santa Fe', 'Providencia', 'Chapultepec', 'Jardines', 'Residencial', 'Industrial', 'Las Águilas', 'Cumbres', 'Valle Alto', 'Contry', 'Colinas', 'Bosques', 'Altavista', 'Montebello'];
  v_types text[] := ARRAY['casa', 'departamento', 'terreno', 'oficina', 'local', 'bodega'];
  v_listing_types text[] := ARRAY['sale', 'rent'];
  v_agent_ids uuid[];
  v_state_idx int;
  v_result jsonb;
BEGIN
  -- Get existing agent IDs (or create test ones)
  SELECT ARRAY_AGG(DISTINCT agent_id) INTO v_agent_ids
  FROM properties
  WHERE agent_id IS NOT NULL
  LIMIT 100;

  -- If no agents, use a placeholder
  IF v_agent_ids IS NULL OR array_length(v_agent_ids, 1) IS NULL THEN
    v_agent_ids := ARRAY[gen_random_uuid()];
  END IF;

  -- Insert in batches
  WHILE v_inserted < p_total_count LOOP
    v_batch := v_batch + 1;
    v_batch_start := clock_timestamp();

    INSERT INTO properties (
      id, title, description, price, currency, type, listing_type,
      address, colonia, municipality, state,
      lat, lng, geom,
      bedrooms, bathrooms, parking, sqft, lot_size,
      status, is_featured, agent_id,
      created_at, updated_at
    )
    SELECT
      gen_random_uuid(),
      -- Title
      CASE (random() * 5)::int
        WHEN 0 THEN 'Hermosa ' || v_types[1 + (random() * 5)::int] || ' en ' || v_colonias[1 + (random() * 19)::int]
        WHEN 1 THEN 'Amplia ' || v_types[1 + (random() * 5)::int] || ' con excelente ubicación'
        WHEN 2 THEN v_types[1 + (random() * 5)::int] || ' de lujo en zona exclusiva'
        WHEN 3 THEN 'Moderna ' || v_types[1 + (random() * 5)::int] || ' recién remodelada'
        WHEN 4 THEN 'Espectacular ' || v_types[1 + (random() * 5)::int] || ' con vista panorámica'
        ELSE 'Increíble ' || v_types[1 + (random() * 5)::int] || ' a excelente precio'
      END,
      -- Description
      'Propiedad de prueba generada automáticamente para test de carga. ' ||
      'Cuenta con acabados de primera calidad, excelente iluminación natural y ubicación privilegiada. ' ||
      'Ideal para familias que buscan comodidad y seguridad.',
      -- Price (500K - 50M for sale, 5K - 100K for rent)
      CASE WHEN random() > 0.3
        THEN (500000 + (random() * 49500000))::numeric
        ELSE (5000 + (random() * 95000))::numeric
      END,
      'MXN',
      -- Type
      v_types[1 + (random() * 5)::int]::property_type,
      -- Listing type
      CASE WHEN random() > 0.3 THEN 'sale' ELSE 'rent' END,
      -- Address
      'Calle ' || (1 + (random() * 500)::int)::text || ' #' || (1 + (random() * 999)::int)::text,
      -- Colonia
      v_colonias[1 + (random() * 19)::int],
      -- Municipality & State (correlated)
      v_municipalities[(1 + (i % 10))][(1 + (random() * 4)::int)],
      v_states[1 + (i % 10)],
      -- Lat/Lng (México bounding box: 14.5-32.7 lat, -117.1 to -86.7 lng)
      19.0 + (random() * 6) - 3,  -- Centered around Mexico City
      -99.0 + (random() * 6) - 3,
      -- Geom
      ST_SetSRID(ST_MakePoint(-99.0 + (random() * 6) - 3, 19.0 + (random() * 6) - 3), 4326),
      -- Bedrooms (1-6)
      CASE WHEN random() > 0.2 THEN (1 + (random() * 5)::int) ELSE NULL END,
      -- Bathrooms (1-5)
      CASE WHEN random() > 0.2 THEN (1 + (random() * 4)::int) ELSE NULL END,
      -- Parking (0-4)
      CASE WHEN random() > 0.3 THEN (random() * 4)::int ELSE NULL END,
      -- Sqft (50-1000 m2)
      (50 + (random() * 950))::int,
      -- Lot size
      CASE WHEN random() > 0.5 THEN (100 + (random() * 900))::int ELSE NULL END,
      -- Status (mostly active)
      CASE (random() * 20)::int
        WHEN 0 THEN 'pendiente_aprobacion'
        WHEN 1 THEN 'expirada'
        WHEN 2 THEN 'inactiva'
        ELSE 'activa'
      END::property_status,
      -- Featured (5% chance)
      random() < 0.05,
      -- Agent ID
      v_agent_ids[1 + (random() * (array_length(v_agent_ids, 1) - 1))::int],
      -- Timestamps (spread over last 2 years)
      NOW() - (random() * interval '730 days'),
      NOW() - (random() * interval '30 days')
    FROM generate_series(1, LEAST(p_batch_size, p_total_count - v_inserted)) AS i;

    v_inserted := v_inserted + LEAST(p_batch_size, p_total_count - v_inserted);

    -- Log progress every 10 batches
    IF v_batch % 10 = 0 THEN
      RAISE NOTICE 'Batch %: Inserted % / % properties (%.2f%%) - Batch time: %ms',
        v_batch,
        v_inserted,
        p_total_count,
        (v_inserted::float / p_total_count * 100),
        EXTRACT(MILLISECOND FROM (clock_timestamp() - v_batch_start));
    END IF;

    -- Commit and breathe every 50 batches
    IF v_batch % 50 = 0 THEN
      PERFORM pg_sleep(0.1);
    END IF;
  END LOOP;

  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'total_inserted', v_inserted,
    'batches', v_batch,
    'duration_seconds', EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)),
    'properties_per_second', v_inserted / NULLIF(EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)), 0)
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- NOTE: Don't auto-execute - this should be called manually after review
-- To execute: SELECT generate_test_properties(950000, 5000);

COMMENT ON FUNCTION generate_test_properties IS 'Generates test properties for load testing. Call with SELECT generate_test_properties(count, batch_size);';
