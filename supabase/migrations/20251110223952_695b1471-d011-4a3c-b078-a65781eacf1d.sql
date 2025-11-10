-- ====================================
-- SISTEMA DE PRE-MODERACIÓN INTELIGENTE CON IA
-- ====================================
-- Este script agrega campos para almacenar resultados de pre-moderación automática usando Lovable AI

-- 1. Crear enum para estado de pre-moderación IA
CREATE TYPE ai_moderation_status AS ENUM ('pass', 'review', 'reject', 'pending');

-- 2. Agregar columnas de pre-moderación IA a properties
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS ai_moderation_score NUMERIC(5,2) CHECK (ai_moderation_score >= 0 AND ai_moderation_score <= 100),
ADD COLUMN IF NOT EXISTS ai_moderation_status ai_moderation_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS ai_moderation_notes TEXT,
ADD COLUMN IF NOT EXISTS ai_moderated_at TIMESTAMP WITH TIME ZONE;

-- 3. Crear índice para búsquedas de propiedades por estado de IA
CREATE INDEX IF NOT EXISTS idx_properties_ai_moderation_status ON public.properties(ai_moderation_status);

-- 4. Comentarios para documentación
COMMENT ON COLUMN public.properties.ai_moderation_score IS 'Score de 0-100 asignado por IA. Mayor score = mejor calidad';
COMMENT ON COLUMN public.properties.ai_moderation_status IS 'Estado de pre-moderación: pass (auto-aprobar), review (revisar humano), reject (auto-rechazar), pending (sin analizar)';
COMMENT ON COLUMN public.properties.ai_moderation_notes IS 'Notas y justificación de la IA sobre su decisión';
COMMENT ON COLUMN public.properties.ai_moderated_at IS 'Fecha y hora cuando la IA analizó la propiedad';