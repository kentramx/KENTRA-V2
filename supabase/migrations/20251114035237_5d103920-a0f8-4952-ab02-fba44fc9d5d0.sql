-- Crear tabla para idempotencia de webhooks
CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Índice para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_event_id ON public.processed_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_event_type ON public.processed_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_processed_at ON public.processed_webhook_events(processed_at);

-- RLS policies
ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;

-- Solo super admins pueden ver webhooks procesados
CREATE POLICY "Super admins can view processed webhooks"
  ON public.processed_webhook_events
  FOR SELECT
  USING (is_super_admin(auth.uid()));

-- Sistema puede insertar (edge function sin JWT)
CREATE POLICY "System can insert webhook events"
  ON public.processed_webhook_events
  FOR INSERT
  WITH CHECK (true);

-- Comentarios
COMMENT ON TABLE public.processed_webhook_events IS 'Registro de eventos de webhook procesados para garantizar idempotencia';
COMMENT ON COLUMN public.processed_webhook_events.event_id IS 'ID único del evento de Stripe';
COMMENT ON COLUMN public.processed_webhook_events.event_type IS 'Tipo de evento (checkout.session.completed, etc.)';
COMMENT ON COLUMN public.processed_webhook_events.processed_at IS 'Timestamp de cuando se procesó el evento';
COMMENT ON COLUMN public.processed_webhook_events.metadata IS 'Información adicional del evento';