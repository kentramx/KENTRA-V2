-- Agregar columnas para trackear reenvíos y historial de rechazos
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS resubmission_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS rejection_history JSONB DEFAULT '[]'::jsonb;

-- Agregar constraint para limitar reenvíos a máximo 3
ALTER TABLE public.properties
ADD CONSTRAINT resubmission_limit CHECK (resubmission_count <= 3);

-- Crear índice para queries de moderación
CREATE INDEX IF NOT EXISTS idx_properties_moderation 
ON public.properties(status, resubmission_count, created_at DESC)
WHERE status = 'pendiente_aprobacion';

-- Comentarios
COMMENT ON COLUMN public.properties.resubmission_count IS 'Número de veces que la propiedad ha sido reenviada después de rechazo (máx: 3)';
COMMENT ON COLUMN public.properties.rejection_history IS 'Historial de rechazos con razones y fechas en formato JSON';