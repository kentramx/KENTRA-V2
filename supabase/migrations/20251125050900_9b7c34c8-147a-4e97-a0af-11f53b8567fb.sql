-- Tabla para tracking de pagos pendientes (mejora observabilidad)
CREATE TABLE IF NOT EXISTS pending_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkout_session_id TEXT NOT NULL UNIQUE,
  payment_method TEXT NOT NULL, -- 'oxxo', 'customer_balance'
  plan_id UUID REFERENCES subscription_plans(id),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MXN',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'expired'
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB
);

CREATE INDEX idx_pending_payments_user ON pending_payments(user_id);
CREATE INDEX idx_pending_payments_status ON pending_payments(status);
CREATE INDEX idx_pending_payments_expires ON pending_payments(expires_at);

-- Agregar campo metadata a user_subscriptions si no existe
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_subscriptions' 
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE user_subscriptions ADD COLUMN metadata JSONB;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE pending_payments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para pending_payments
CREATE POLICY "Users can view their own pending payments"
ON pending_payments FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pending payments"
ON pending_payments FOR INSERT
WITH CHECK (auth.uid() = user_id);