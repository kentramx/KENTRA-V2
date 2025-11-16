
-- Fix trigger_auto_assign_badges function properly to avoid field access errors
CREATE OR REPLACE FUNCTION public.trigger_auto_assign_badges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
BEGIN
  -- Determine user_id based on the table that triggered this
  IF TG_TABLE_NAME = 'profiles' THEN
    v_user_id := NEW.id;
  ELSIF TG_TABLE_NAME = 'properties' THEN
    v_user_id := NEW.agent_id;
  ELSIF TG_TABLE_NAME = 'agent_reviews' THEN
    v_user_id := NEW.agent_id;
  ELSIF TG_TABLE_NAME = 'user_subscriptions' THEN
    v_user_id := NEW.user_id;
  ELSE
    v_user_id := NULL;
  END IF;
  
  -- Call auto_assign_badges only if we have a valid user_id
  IF v_user_id IS NOT NULL THEN
    PERFORM auto_assign_badges(v_user_id);
  END IF;
  
  RETURN NEW;
END;
$function$;
