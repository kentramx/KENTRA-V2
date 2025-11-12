-- Agregar campos de perfil para avatar, biografía y ubicación

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT;

COMMENT ON COLUMN public.profiles.avatar_url IS 'URL de la foto de perfil del usuario';
COMMENT ON COLUMN public.profiles.bio IS 'Biografía corta del usuario (máx 500 caracteres)';
COMMENT ON COLUMN public.profiles.city IS 'Ciudad/Municipio del usuario';
COMMENT ON COLUMN public.profiles.state IS 'Estado del usuario';

-- Crear índice para búsquedas por ubicación
CREATE INDEX IF NOT EXISTS idx_profiles_state ON public.profiles(state);
CREATE INDEX IF NOT EXISTS idx_profiles_city ON public.profiles(city);