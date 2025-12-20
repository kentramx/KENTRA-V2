-- Función para buscar user_id por email (usada por edge functions)
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(user_email TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE email = lower(user_email) LIMIT 1;
$$;

-- Solo service role puede ejecutar esta función
REVOKE ALL ON FUNCTION public.get_user_id_by_email(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_id_by_email(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.get_user_id_by_email(TEXT) FROM authenticated;