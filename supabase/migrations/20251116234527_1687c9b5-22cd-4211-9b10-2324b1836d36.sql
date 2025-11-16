
-- Fix trigger_auto_assign_badges function to handle user_subscriptions table
CREATE OR REPLACE FUNCTION public.trigger_auto_assign_badges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Call auto_assign_badges for the affected user
  PERFORM auto_assign_badges(
    CASE 
      WHEN TG_TABLE_NAME = 'profiles' THEN NEW.id
      WHEN TG_TABLE_NAME = 'properties' THEN NEW.agent_id
      WHEN TG_TABLE_NAME = 'agent_reviews' THEN NEW.agent_id
      WHEN TG_TABLE_NAME = 'user_subscriptions' THEN NEW.user_id
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$function$;
