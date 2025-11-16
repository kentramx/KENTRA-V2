-- Fix resubmit_property to use actual resubmission_count column
DROP FUNCTION IF EXISTS resubmit_property(UUID);

CREATE OR REPLACE FUNCTION resubmit_property(property_id UUID)
RETURNS jsonb AS $$
DECLARE
  current_status text;
  current_resubmission_count integer;
  max_resubmissions integer := 3;
  agent_uuid uuid;
  property_title_var text;
  agent_name_var text;
BEGIN
  -- Get current status and resubmission count
  SELECT p.status, p.resubmission_count, p.agent_id, p.title, prof.name
  INTO current_status, current_resubmission_count, agent_uuid, property_title_var, agent_name_var
  FROM properties p
  LEFT JOIN profiles prof ON p.agent_id = prof.id
  WHERE p.id = property_id;

  -- Validate property exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Propiedad no encontrada'
    );
  END IF;

  -- Validate status is pausada or rechazada
  IF current_status NOT IN ('pausada', 'rechazada') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Solo se pueden reenviar propiedades pausadas o rechazadas'
    );
  END IF;

  -- Use the actual resubmission_count column (not recalculated from history)
  current_resubmission_count := COALESCE(current_resubmission_count, 0);

  -- Validate resubmission limit (must be LESS than 3)
  IF current_resubmission_count >= max_resubmissions THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Has alcanzado el límite máximo de reintentos (3)'
    );
  END IF;

  -- Update property status to pendiente_aprobacion
  UPDATE properties
  SET 
    status = 'pendiente_aprobacion',
    updated_at = now()
  WHERE id = property_id;

  -- Record in moderation history
  INSERT INTO property_moderation_history (
    property_id,
    agent_id,
    action,
    notes
  ) VALUES (
    property_id,
    agent_uuid,
    'resubmitted',
    format('Reenvío #%s - Propiedad reenviada para revisión', current_resubmission_count + 1)
  );

  -- Return success with metadata
  RETURN jsonb_build_object(
    'success', true,
    'remaining_attempts', max_resubmissions - current_resubmission_count,
    'resubmission_number', current_resubmission_count,
    'property_title', property_title_var,
    'agent_name', agent_name_var
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;