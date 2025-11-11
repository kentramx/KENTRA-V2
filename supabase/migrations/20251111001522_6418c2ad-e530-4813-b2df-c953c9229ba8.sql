-- Crear función segura para cambio de rol entre agent y agency
CREATE OR REPLACE FUNCTION public.change_user_role(
  new_role app_role
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_role app_role;
  user_subscription_plan text;
  plan_features jsonb;
BEGIN
  -- Obtener rol actual del usuario autenticado
  SELECT role INTO current_user_role
  FROM user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;

  -- Validar que el rol actual existe
  IF current_user_role IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No tienes un rol asignado'
    );
  END IF;

  -- RESTRICCIÓN 1: No permitir cambios desde/hacia roles administrativos
  IF current_user_role IN ('super_admin', 'moderator') OR 
     new_role IN ('super_admin', 'moderator') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No se pueden modificar roles administrativos'
    );
  END IF;

  -- RESTRICCIÓN 2: Solo permitir cambios específicos
  IF NOT (
    (current_user_role = 'agent' AND new_role = 'agency') OR
    (current_user_role = 'agency' AND new_role = 'agent') OR
    (current_user_role = 'buyer' AND new_role IN ('agent', 'agency'))
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cambio de rol no permitido'
    );
  END IF;

  -- RESTRICCIÓN 3: Validar suscripción activa para agent/agency
  IF new_role IN ('agent', 'agency') THEN
    SELECT sp.name, sp.features INTO user_subscription_plan, plan_features
    FROM user_subscriptions us
    JOIN subscription_plans sp ON sp.id = us.plan_id
    WHERE us.user_id = auth.uid() 
      AND us.status = 'active'
    LIMIT 1;

    IF user_subscription_plan IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Necesitas una suscripción activa para cambiar a este rol',
        'requires_subscription', true
      );
    END IF;

    -- Validar que el plan sea apropiado para el nuevo rol
    IF new_role = 'agency' AND NOT (
      user_subscription_plan IN ('inmobiliaria_start', 'inmobiliaria_grow', 'inmobiliaria_pro')
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Para convertirte en agencia necesitas un plan de inmobiliaria',
        'requires_plan_change', true,
        'suggested_route', '/pricing-inmobiliaria'
      );
    END IF;

    IF new_role = 'agent' AND NOT (
      user_subscription_plan IN ('agente_basico', 'agente_pro', 'agente_elite')
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Para ser agente independiente necesitas un plan de agente',
        'requires_plan_change', true,
        'suggested_route', '/pricing-agente'
      );
    END IF;
  END IF;

  -- CASO ESPECIAL: Agency -> Agent (verificar que no tenga agentes asignados)
  IF current_user_role = 'agency' AND new_role = 'agent' THEN
    IF EXISTS (
      SELECT 1 FROM agency_agents aa
      JOIN agencies a ON a.id = aa.agency_id
      WHERE a.owner_id = auth.uid()
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Primero debes eliminar todos los agentes de tu equipo',
        'requires_cleanup', true
      );
    END IF;
  END IF;

  -- Ejecutar cambio de rol
  UPDATE user_roles
  SET role = new_role
  WHERE user_id = auth.uid();

  -- CASO ESPECIAL: Agent -> Agency (crear registro en tabla agencies)
  IF current_user_role = 'agent' AND new_role = 'agency' THEN
    INSERT INTO agencies (owner_id, name, email)
    SELECT 
      auth.uid(), 
      p.name,
      (SELECT email FROM auth.users WHERE id = auth.uid())
    FROM profiles p 
    WHERE p.id = auth.uid()
    ON CONFLICT (owner_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'previous_role', current_user_role,
    'new_role', new_role,
    'message', 'Rol actualizado exitosamente'
  );
END;
$$;