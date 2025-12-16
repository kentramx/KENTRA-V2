-- Crear enum para status de usuario
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'banned');

-- Agregar campo status a profiles con valor por defecto 'active'
ALTER TABLE profiles 
ADD COLUMN status user_status NOT NULL DEFAULT 'active';

-- Agregar campos para auditoría de suspensión
ALTER TABLE profiles 
ADD COLUMN suspended_at TIMESTAMPTZ,
ADD COLUMN suspended_reason TEXT,
ADD COLUMN suspended_by UUID;

-- Índice para búsquedas por status
CREATE INDEX idx_profiles_status ON profiles(status);

-- Política RLS para que admins puedan actualizar status de otros usuarios
CREATE POLICY "Admins can update user status"
ON profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('super_admin', 'moderator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('super_admin', 'moderator')
  )
);