-- Fix security issues: Create promote_user_to_admin function with proper validations

-- Create the promote_user_to_admin function with security validations
CREATE OR REPLACE FUNCTION promote_user_to_admin(
  target_user_id UUID,
  new_admin_role app_role
)
RETURNS VOID AS $$
DECLARE
  target_email TEXT;
  caller_id UUID;
BEGIN
  -- Get caller ID
  caller_id := auth.uid();
  
  -- Verify caller is super_admin
  IF NOT is_super_admin(caller_id) THEN
    RAISE EXCEPTION 'Only super administrators can promote users';
  END IF;

  -- Verify target role is administrative
  IF new_admin_role NOT IN ('super_admin', 'moderator') THEN
    RAISE EXCEPTION 'Invalid role: %. Only super_admin and moderator roles can be assigned', new_admin_role;
  END IF;

  -- Get target user's email from auth.users
  SELECT email INTO target_email
  FROM auth.users
  WHERE id = target_user_id;

  IF target_email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- CRITICAL VALIDATION: Only @kentra.com.mx emails can be promoted
  IF NOT target_email LIKE '%@kentra.com.mx' THEN
    RAISE EXCEPTION 'Only users with @kentra.com.mx email addresses can be promoted to administrative roles';
  END IF;

  -- Insert or update role
  INSERT INTO public.user_roles (user_id, role, granted_by, granted_at)
  VALUES (target_user_id, new_admin_role, caller_id, NOW())
  ON CONFLICT (user_id, role) 
  DO UPDATE SET 
    granted_by = caller_id,
    granted_at = NOW();

  -- Log success
  RAISE NOTICE 'User % promoted to % by %', target_user_id, new_admin_role, caller_id;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permission to authenticated users (function itself checks super_admin)
GRANT EXECUTE ON FUNCTION promote_user_to_admin(UUID, app_role) TO authenticated;

-- Verify RLS is enabled on all public tables (excluding PostGIS system tables)
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename NOT IN ('spatial_ref_sys', 'geography_columns', 'geometry_columns')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl.tablename);
  END LOOP;
END $$;