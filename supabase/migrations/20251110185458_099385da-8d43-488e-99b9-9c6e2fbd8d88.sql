-- Create trigger function to auto-update badges on profile changes
CREATE OR REPLACE FUNCTION public.trigger_auto_assign_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Call auto_assign_badges for the affected user
  PERFORM auto_assign_badges(
    CASE 
      WHEN TG_TABLE_NAME = 'profiles' THEN NEW.id
      WHEN TG_TABLE_NAME = 'properties' THEN NEW.agent_id
      WHEN TG_TABLE_NAME = 'agent_reviews' THEN NEW.agent_id
    END
  );
  RETURN NEW;
END;
$$;

-- Trigger on profile updates (when agent updates their profile)
CREATE TRIGGER trigger_badges_on_profile_update
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_assign_badges();

-- Trigger on property status changes (when a property is sold)
CREATE TRIGGER trigger_badges_on_property_sold
  AFTER UPDATE ON public.properties
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'vendida')
  EXECUTE FUNCTION public.trigger_auto_assign_badges();

-- Trigger on new reviews (when agent receives a new review)
CREATE TRIGGER trigger_badges_on_review_insert
  AFTER INSERT ON public.agent_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_assign_badges();

-- Trigger on review updates (when rating changes)
CREATE TRIGGER trigger_badges_on_review_update
  AFTER UPDATE ON public.agent_reviews
  FOR EACH ROW
  WHEN (OLD.rating IS DISTINCT FROM NEW.rating)
  EXECUTE FUNCTION public.trigger_auto_assign_badges();

-- Trigger on subscription changes (when plan changes)
CREATE TRIGGER trigger_badges_on_subscription_change
  AFTER UPDATE ON public.user_subscriptions
  FOR EACH ROW
  WHEN (OLD.plan_id IS DISTINCT FROM NEW.plan_id OR OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.trigger_auto_assign_badges();

-- Also trigger when new active properties are created
CREATE TRIGGER trigger_badges_on_property_insert
  AFTER INSERT ON public.properties
  FOR EACH ROW
  WHEN (NEW.status = 'activa')
  EXECUTE FUNCTION public.trigger_auto_assign_badges();