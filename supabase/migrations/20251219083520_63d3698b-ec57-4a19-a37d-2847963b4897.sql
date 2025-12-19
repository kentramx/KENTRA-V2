-- Tabla para almacenar tokens de verificación y recovery de email
CREATE TABLE public.auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  token_type TEXT NOT NULL CHECK (token_type IN ('verification', 'recovery')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Índices para búsqueda eficiente
CREATE INDEX idx_auth_tokens_email ON public.auth_tokens(email);
CREATE INDEX idx_auth_tokens_type ON public.auth_tokens(token_type);
CREATE INDEX idx_auth_tokens_expires ON public.auth_tokens(expires_at) WHERE used_at IS NULL;
CREATE INDEX idx_auth_tokens_user_id ON public.auth_tokens(user_id);

-- Habilitar RLS
ALTER TABLE public.auth_tokens ENABLE ROW LEVEL SECURITY;

-- Solo el sistema puede gestionar tokens (via service role en Edge Functions)
-- No hay políticas para usuarios normales - es intencional para seguridad

-- Función para limpiar tokens expirados (ejecutar periódicamente)
CREATE OR REPLACE FUNCTION public.cleanup_expired_auth_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.auth_tokens
  WHERE expires_at < now() - interval '7 days'
     OR (used_at IS NOT NULL AND used_at < now() - interval '1 day');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Comentarios para documentación
COMMENT ON TABLE public.auth_tokens IS 'Tokens para verificación de email y recuperación de contraseña';
COMMENT ON COLUMN public.auth_tokens.token_type IS 'verification = confirmación de email, recovery = reset de contraseña';
COMMENT ON COLUMN public.auth_tokens.token_hash IS 'Hash SHA-256 del token, nunca almacenamos el token en texto plano';
COMMENT ON COLUMN public.auth_tokens.used_at IS 'Timestamp cuando se usó el token, NULL si no se ha usado';