
-- Asignar rol 'agent' a todos los usuarios demo
DO $$
DECLARE
  v_user_id UUID;
  i INTEGER;
BEGIN
  FOR i IN 1..100 LOOP
    v_user_id := ('00000000-0000-0000-0000-' || LPAD(i::TEXT, 12, '0'))::UUID;
    
    INSERT INTO user_roles (user_id, role, granted_at)
    VALUES (v_user_id, 'agent', NOW())
    ON CONFLICT (user_id, role) DO NOTHING;
  END LOOP;
END $$;

-- Crear suscripciones activas para agentes demo (40% Start, 40% Pro, 20% Elite)
DO $$
DECLARE
  v_user_id UUID;
  v_plan_id UUID;
  v_plan_name TEXT;
  i INTEGER;
  v_distribution INTEGER;
BEGIN
  FOR i IN 1..100 LOOP
    v_user_id := ('00000000-0000-0000-0000-' || LPAD(i::TEXT, 12, '0'))::UUID;
    
    -- Determinar distribución de planes
    v_distribution := i % 10;
    
    IF v_distribution < 4 THEN
      -- 40% Start
      SELECT id INTO v_plan_id FROM subscription_plans WHERE name = 'agente_start' LIMIT 1;
    ELSIF v_distribution < 8 THEN
      -- 40% Pro
      SELECT id INTO v_plan_id FROM subscription_plans WHERE name = 'agente_pro' LIMIT 1;
    ELSE
      -- 20% Elite
      SELECT id INTO v_plan_id FROM subscription_plans WHERE name = 'agente_elite' LIMIT 1;
    END IF;
    
    INSERT INTO user_subscriptions (
      user_id,
      plan_id,
      status,
      billing_cycle,
      current_period_start,
      current_period_end,
      created_at
    ) VALUES (
      v_user_id,
      v_plan_id,
      'active',
      'monthly',
      NOW(),
      NOW() + INTERVAL '30 days',
      NOW()
    )
    ON CONFLICT (user_id) DO NOTHING;
  END LOOP;
END $$;
