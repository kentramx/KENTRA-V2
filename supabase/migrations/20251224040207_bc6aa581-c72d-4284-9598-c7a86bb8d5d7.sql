-- Crear índices faltantes para mejorar performance

-- Índice para búsqueda de imágenes por propiedad
CREATE INDEX IF NOT EXISTS idx_images_property_id ON images(property_id);

-- Índice para búsquedas guardadas del usuario
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON saved_searches(user_id);

-- Índice para log de expiración de propiedades
CREATE INDEX IF NOT EXISTS idx_property_expiration_log_property_id ON property_expiration_log(property_id);

-- Limpiar suscripción huérfana
DELETE FROM user_subscriptions 
WHERE user_id NOT IN (SELECT id FROM auth.users);