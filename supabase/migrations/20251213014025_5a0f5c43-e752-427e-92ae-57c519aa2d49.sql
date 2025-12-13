-- Tabla para tracking de eventos procesados (idempotencia)
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,  -- ID del evento de Stripe (evt_...)
  event_type TEXT NOT NULL,       -- Tipo de evento (checkout.session.completed, etc.)
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB,                  -- Payload completo para debugging (opcional)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsquedas rápidas por event_id
CREATE INDEX idx_stripe_webhook_events_event_id ON stripe_webhook_events(event_id);

-- Índice para limpiar eventos viejos
CREATE INDEX idx_stripe_webhook_events_created_at ON stripe_webhook_events(created_at);

-- RLS: Solo el service role puede acceder (sin políticas = solo service role)
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Función para limpiar eventos viejos (más de 30 días)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM stripe_webhook_events 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;