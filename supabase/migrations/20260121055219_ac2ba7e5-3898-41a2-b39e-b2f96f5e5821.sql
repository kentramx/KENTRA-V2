-- ============================================
-- MIGRACIÓN: Corregir FK de properties.agent_id
-- Propósito: Cambiar la FK de auth.users a profiles
-- para que PostgREST pueda resolver profiles!agent_id
-- ============================================

-- 1. Eliminar la FK actual hacia auth.users (si existe)
ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_agent_id_fkey;

-- 2. Crear nueva FK hacia profiles
ALTER TABLE properties 
  ADD CONSTRAINT properties_agent_id_fkey 
  FOREIGN KEY (agent_id) 
  REFERENCES profiles(id) 
  ON DELETE SET NULL;

-- 3. Verificación
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'properties_agent_id_fkey' 
    AND table_name = 'properties'
  ) THEN
    RAISE NOTICE '✅ FK properties.agent_id -> profiles.id creada exitosamente';
  ELSE
    RAISE WARNING '❌ Error: FK no fue creada';
  END IF;
END $$;