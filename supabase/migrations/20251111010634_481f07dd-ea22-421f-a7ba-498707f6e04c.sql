-- Fix recursive RLS on profiles causing empty results for public directory
-- Replace policy using direct user_roles subquery with security definer function has_role()

-- Ensure RLS is enabled (it already is, but keep for clarity)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop old policy that referenced user_roles directly (recursively restricted)
DROP POLICY IF EXISTS "Public can view agent profiles" ON public.profiles;

-- Create new policy that safely checks roles via SECURITY DEFINER function
CREATE POLICY "Public can view agent and agency profiles"
ON public.profiles
FOR SELECT
USING (
  public.has_role(id, 'agent'::app_role) OR public.has_role(id, 'agency'::app_role)
);
