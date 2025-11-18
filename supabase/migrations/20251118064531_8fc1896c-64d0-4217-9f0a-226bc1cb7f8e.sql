-- Eliminar versión duplicada de get_properties_cursor que causa error PGRST203
-- Solo queremos mantener la versión con p_cursor timestamp with time zone

-- Eliminar versión antigua con p_cursor uuid
DROP FUNCTION IF EXISTS public.get_properties_cursor(
  uuid, integer, text, text, text, text, numeric, numeric
);

-- La versión correcta con timestamp ya existe y se mantiene automáticamente