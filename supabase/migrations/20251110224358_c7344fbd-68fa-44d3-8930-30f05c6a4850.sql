-- ====================================
-- CREAR TABLA DE HISTORIAL DE MODERACIÓN
-- ====================================

-- 1. Crear enum para acciones de moderación si no existe
DO $$ BEGIN
  CREATE TYPE moderation_action AS ENUM ('approved', 'rejected', 'resubmitted', 'auto_approved');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Crear tabla de historial de moderación
CREATE TABLE IF NOT EXISTS public.property_moderation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL,
  admin_id UUID, -- NULL si es auto-aprobación
  action moderation_action NOT NULL,
  previous_data JSONB,
  rejection_reason JSONB,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3. Crear índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_moderation_history_property ON public.property_moderation_history(property_id);
CREATE INDEX IF NOT EXISTS idx_moderation_history_agent ON public.property_moderation_history(agent_id);
CREATE INDEX IF NOT EXISTS idx_moderation_history_admin ON public.property_moderation_history(admin_id);
CREATE INDEX IF NOT EXISTS idx_moderation_history_action ON public.property_moderation_history(action);
CREATE INDEX IF NOT EXISTS idx_moderation_history_created ON public.property_moderation_history(created_at DESC);

-- 4. Habilitar RLS
ALTER TABLE public.property_moderation_history ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS
CREATE POLICY "Agentes pueden ver su propio historial" ON public.property_moderation_history
  FOR SELECT USING (auth.uid() = agent_id);

CREATE POLICY "Admins pueden ver todo el historial" ON public.property_moderation_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'moderator', 'super_admin')
    )
  );

CREATE POLICY "Solo sistema puede insertar registros" ON public.property_moderation_history
  FOR INSERT WITH CHECK (true);