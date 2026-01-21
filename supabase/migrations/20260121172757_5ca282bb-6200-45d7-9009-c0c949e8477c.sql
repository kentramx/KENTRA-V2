-- Actualizar rol existente a super_admin para contact@kentra.com.mx
UPDATE public.user_roles 
SET role = 'super_admin', 
    granted_at = NOW(),
    granted_by = '020f7cb3-0444-46a5-a9e8-84c8ff7d9175'
WHERE user_id = '020f7cb3-0444-46a5-a9e8-84c8ff7d9175';