-- ============================================================================
-- SEED DEMO AGENTS - Crear 100 agentes demo funcionales
-- ============================================================================
-- Este script crea 100 agentes de prueba con:
-- - Emails: agente1@demo.kentra.com.mx hasta agente100@demo.kentra.com.mx
-- - Contraseña común: DemoKentra2024!
-- - Distribución de planes: 40% Start, 40% Pro, 20% Elite
-- - Perfiles completos con datos realistas
-- ============================================================================

-- Paso 1: Insertar usuarios en auth.users
-- El trigger handle_new_user creará automáticamente los profiles
INSERT INTO auth.users (
  instance_id,
  id, 
  aud,
  role,
  email, 
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at, 
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
SELECT
  '00000000-0000-0000-0000-000000000000'::uuid,
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'agente' || i || '@demo.kentra.com.mx',
  crypt('DemoKentra2024!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object(
    'name', (ARRAY[
      'Juan Pérez', 'María González', 'Carlos Rodríguez', 'Ana Martínez',
      'Luis Hernández', 'Carmen López', 'José García', 'Laura Sánchez',
      'Miguel Torres', 'Patricia Ramírez', 'Roberto Flores', 'Isabel Morales',
      'Fernando Cruz', 'Sofía Jiménez', 'Diego Romero', 'Valentina Castro',
      'Andrés Ortiz', 'Daniela Vargas', 'Ricardo Ruiz', 'Gabriela Mendoza',
      'Eduardo Núñez', 'Lucía Guerrero', 'Pablo Méndez', 'Camila Herrera',
      'Javier Reyes', 'Mariana Silva', 'Alejandro Guzmán', 'Natalia Díaz'
    ])[1 + (i % 28)] || ' - Agente Demo ' || i,
    'role', 'agent'
  ),
  now(),
  now(),
  '',
  '',
  '',
  ''
FROM generate_series(1, 100) AS i;

-- Esperar un momento para que el trigger handle_new_user procese
-- (El trigger se ejecuta automáticamente y crea los profiles)

-- Paso 2: Insertar roles 'agent' en user_roles
INSERT INTO public.user_roles (user_id, role, granted_at)
SELECT 
  id,
  'agent'::app_role,
  now()
FROM auth.users 
WHERE email LIKE '%@demo.kentra.com.mx';

-- Paso 3: Insertar suscripciones activas con distribución 40/40/20
WITH plan_ids AS (
  SELECT 
    (SELECT id FROM subscription_plans WHERE name = 'agente_start' LIMIT 1) AS start_id,
    (SELECT id FROM subscription_plans WHERE name = 'agente_pro' LIMIT 1) AS pro_id,
    (SELECT id FROM subscription_plans WHERE name = 'agente_elite' LIMIT 1) AS elite_id
),
demo_agents AS (
  SELECT 
    id,
    row_number() OVER (ORDER BY id) AS row_num
  FROM auth.users 
  WHERE email LIKE '%@demo.kentra.com.mx'
)
INSERT INTO public.user_subscriptions (
  user_id,
  plan_id,
  status,
  billing_cycle,
  current_period_start,
  current_period_end,
  featured_reset_date,
  featured_used_this_month,
  cancel_at_period_end
)
SELECT 
  da.id,
  CASE 
    WHEN da.row_num <= 40 THEN plan_ids.start_id  -- 40% Start
    WHEN da.row_num <= 80 THEN plan_ids.pro_id    -- 40% Pro
    ELSE plan_ids.elite_id                         -- 20% Elite
  END AS plan_id,
  'active',
  'monthly',
  now(),
  now() + interval '30 days',
  date_trunc('month', now()) + interval '1 month',
  0,
  false
FROM demo_agents da
CROSS JOIN plan_ids;

-- Paso 4: Actualizar profiles con datos realistas
UPDATE public.profiles
SET
  name = CASE ((id::text::bigint) % 28)
    WHEN 0 THEN 'Juan Pérez'
    WHEN 1 THEN 'María González'
    WHEN 2 THEN 'Carlos Rodríguez'
    WHEN 3 THEN 'Ana Martínez'
    WHEN 4 THEN 'Luis Hernández'
    WHEN 5 THEN 'Carmen López'
    WHEN 6 THEN 'José García'
    WHEN 7 THEN 'Laura Sánchez'
    WHEN 8 THEN 'Miguel Torres'
    WHEN 9 THEN 'Patricia Ramírez'
    WHEN 10 THEN 'Roberto Flores'
    WHEN 11 THEN 'Isabel Morales'
    WHEN 12 THEN 'Fernando Cruz'
    WHEN 13 THEN 'Sofía Jiménez'
    WHEN 14 THEN 'Diego Romero'
    WHEN 15 THEN 'Valentina Castro'
    WHEN 16 THEN 'Andrés Ortiz'
    WHEN 17 THEN 'Daniela Vargas'
    WHEN 18 THEN 'Ricardo Ruiz'
    WHEN 19 THEN 'Gabriela Mendoza'
    WHEN 20 THEN 'Eduardo Núñez'
    WHEN 21 THEN 'Lucía Guerrero'
    WHEN 22 THEN 'Pablo Méndez'
    WHEN 23 THEN 'Camila Herrera'
    WHEN 24 THEN 'Javier Reyes'
    WHEN 25 THEN 'Mariana Silva'
    WHEN 26 THEN 'Alejandro Guzmán'
    ELSE 'Natalia Díaz'
  END || ' - Agente Demo',
  
  bio = 'Agente inmobiliario profesional con más de 10 años de experiencia en el mercado. ' ||
        'Especializado en propiedades residenciales y comerciales de alto nivel. ' ||
        'Comprometido con ayudar a mis clientes a encontrar la propiedad perfecta que se ajuste a sus necesidades. ' ||
        'Servicio personalizado, atención de calidad y asesoría profesional garantizada en cada transacción.',
  
  city = (ARRAY[
    'Ciudad de México', 'Guadalajara', 'Monterrey', 'Puebla', 'Querétaro',
    'León', 'Tijuana', 'Mérida', 'San Luis Potosí', 'Cancún',
    'Aguascalientes', 'Hermosillo', 'Saltillo', 'Morelia', 'Toluca'
  ])[(((id::text::bigint) % 15) + 1)],
  
  state = (ARRAY[
    'Ciudad de México', 'Jalisco', 'Nuevo León', 'Puebla', 'Querétaro',
    'Guanajuato', 'Baja California', 'Yucatán', 'San Luis Potosí', 'Quintana Roo',
    'Aguascalientes', 'Sonora', 'Coahuila', 'Michoacán', 'México'
  ])[(((id::text::bigint) % 15) + 1)],
  
  phone = '+52' || (5500000000 + ((id::text::bigint) % 9999999))::text,
  phone_verified = true,
  phone_verified_at = now(),
  
  whatsapp_number = '+52' || (5500000000 + ((id::text::bigint) % 9999999))::text,
  whatsapp_enabled = true,
  whatsapp_verified = true,
  whatsapp_verified_at = now(),
  
  is_verified = true,
  
  avatar_url = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' || id::text,
  
  updated_at = now()
  
WHERE id IN (
  SELECT id FROM auth.users WHERE email LIKE '%@demo.kentra.com.mx'
);

-- Mensaje de confirmación
DO $$
DECLARE
  agent_count int;
BEGIN
  SELECT COUNT(*) INTO agent_count 
  FROM auth.users 
  WHERE email LIKE '%@demo.kentra.com.mx';
  
  RAISE NOTICE '✅ Seed completado exitosamente!';
  RAISE NOTICE '   - % agentes demo creados', agent_count;
  RAISE NOTICE '   - Contraseña común: DemoKentra2024!';
  RAISE NOTICE '   - Emails: agente1@demo.kentra.com.mx hasta agente%@demo.kentra.com.mx', agent_count;
  RAISE NOTICE '   - Distribución de planes: 40%% Start, 40%% Pro, 20%% Elite';
  RAISE NOTICE '   - Todos los perfiles completados con datos realistas';
END $$;
