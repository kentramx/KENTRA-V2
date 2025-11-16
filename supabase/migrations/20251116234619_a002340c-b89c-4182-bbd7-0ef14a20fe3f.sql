
-- Crear 100 agentes demo en auth.users
DO $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
  v_encrypted_password TEXT;
  i INTEGER;
BEGIN
  -- Password hash for 'DemoKentra2024!' (bcrypt)
  v_encrypted_password := crypt('DemoKentra2024!', gen_salt('bf'));
  
  FOR i IN 1..100 LOOP
    v_user_id := ('00000000-0000-0000-0000-' || LPAD(i::TEXT, 12, '0'))::UUID;
    v_email := 'demo' || i || '@kentra.com.mx';
    
    -- Insertar usuario en auth.users
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      confirmation_token
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_email,
      v_encrypted_password,
      NOW(),
      NOW(),
      NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{}',
      false,
      ''
    )
    ON CONFLICT (id) DO NOTHING;
    
  END LOOP;
END $$;
