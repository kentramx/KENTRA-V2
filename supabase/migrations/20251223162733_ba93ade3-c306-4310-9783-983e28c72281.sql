-- Permitir user_id NULL para tracking anónimo
ALTER TABLE public.whatsapp_interactions 
ALTER COLUMN user_id DROP NOT NULL;

-- Agregar columna session_id para trackear sesiones anónimas
ALTER TABLE public.whatsapp_interactions 
ADD COLUMN IF NOT EXISTS session_id TEXT;

-- Agregar índice para consultas por session_id
CREATE INDEX IF NOT EXISTS idx_whatsapp_interactions_session_id 
ON public.whatsapp_interactions(session_id) 
WHERE session_id IS NOT NULL;

-- Actualizar política RLS para permitir inserts anónimos
DROP POLICY IF EXISTS "Users can insert their own interactions" ON public.whatsapp_interactions;

CREATE POLICY "Anyone can insert interactions" 
ON public.whatsapp_interactions 
FOR INSERT 
WITH CHECK (true);

-- Política para que usuarios vean sus propias interacciones o admins vean todas
DROP POLICY IF EXISTS "Users can view their own interactions" ON public.whatsapp_interactions;

CREATE POLICY "Users can view their own interactions or admins all" 
ON public.whatsapp_interactions 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);