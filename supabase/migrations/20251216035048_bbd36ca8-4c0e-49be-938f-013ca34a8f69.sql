-- Función para obtener usuarios de auth (solo para admins)
CREATE OR REPLACE FUNCTION get_auth_users_for_admin()
RETURNS TABLE (
  id uuid,
  email text,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT 
    id,
    email::text,
    email_confirmed_at,
    last_sign_in_at
  FROM auth.users;
$$;

-- Solo admins pueden ejecutar esta función
REVOKE ALL ON FUNCTION get_auth_users_for_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_auth_users_for_admin() TO authenticated;