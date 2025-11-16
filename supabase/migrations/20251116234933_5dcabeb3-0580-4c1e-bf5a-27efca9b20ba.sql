
-- Agregar 3-6 imágenes de Unsplash a cada propiedad
DO $$
DECLARE
  v_property_id UUID;
  v_property_type TEXT;
  v_image_count INTEGER;
  v_unsplash_ids TEXT[] := ARRAY[
    'photo-1568605114967-8130f3a36994', 'photo-1600596542815-ffad4c1539a9', 'photo-1600607687939-ce8a6c25118c',
    'photo-1600566753190-17f0baa2a6c3', 'photo-1600585154340-be6161a56a0c', 'photo-1600607687644-c7171b42498b',
    'photo-1613977257363-707ba9348227', 'photo-1600566753086-00f18fb6b3ea', 'photo-1512917774080-9991f1c4c750'
  ];
  i INTEGER;
  j INTEGER;
BEGIN
  FOR v_property_id, v_property_type IN 
    SELECT id, type::TEXT FROM properties WHERE agent_id::TEXT LIKE '00000000-0000-0000-0000-%'
  LOOP
    v_image_count := 3 + (RANDOM() * 3)::INTEGER;
    
    FOR i IN 1..v_image_count LOOP
      j := ((i * 7) % 9) + 1;
      INSERT INTO images (property_id, url, position)
      VALUES (
        v_property_id,
        'https://images.unsplash.com/' || v_unsplash_ids[j] || '?w=800&q=80',
        i
      );
    END LOOP;
  END LOOP;
END $$;
