-- Fix trigger to allow property insertions without authenticated user
CREATE OR REPLACE FUNCTION log_property_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if there's an authenticated user OR if it's an INSERT
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.property_assignment_history (
      property_id,
      previous_agent_id,
      new_agent_id,
      assigned_by
    ) VALUES (
      NEW.id,
      NULL,
      NEW.agent_id,
      COALESCE(auth.uid(), NEW.agent_id) -- Use agent_id if no authenticated user
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.agent_id IS DISTINCT FROM NEW.agent_id THEN
    INSERT INTO public.property_assignment_history (
      property_id,
      previous_agent_id,
      new_agent_id,
      assigned_by
    ) VALUES (
      NEW.id,
      OLD.agent_id,
      NEW.agent_id,
      COALESCE(auth.uid(), NEW.agent_id)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;