-- Drop existing profile trigger that was firing on every profile update
DROP TRIGGER IF EXISTS trigger_badges_on_profile_update ON public.profiles;

-- Recreate profile trigger to only fire on relevant changes (is_verified, name)
-- This prevents unnecessary badge recalculation when updating whatsapp config
CREATE TRIGGER trigger_badges_on_profile_update
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (
    OLD.is_verified IS DISTINCT FROM NEW.is_verified OR
    OLD.name IS DISTINCT FROM NEW.name
  )
  EXECUTE FUNCTION public.trigger_auto_assign_badges();