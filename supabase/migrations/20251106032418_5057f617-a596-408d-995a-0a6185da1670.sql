-- Agregar columna read_at a la tabla messages para confirmación de lectura
ALTER TABLE public.messages
ADD COLUMN read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Crear índice para queries rápidas de mensajes no leídos
CREATE INDEX idx_messages_read_status ON public.messages(conversation_id, read_at, sender_id);

-- Función para marcar mensajes como leídos
CREATE OR REPLACE FUNCTION public.mark_messages_as_read(
  p_conversation_id UUID,
  p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Marcar como leídos todos los mensajes que no son del usuario actual
  UPDATE public.messages
  SET read_at = NOW()
  WHERE conversation_id = p_conversation_id
    AND sender_id != p_user_id
    AND read_at IS NULL;
END;
$$;