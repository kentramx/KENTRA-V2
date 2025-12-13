-- Tabla para registrar disputas/chargebacks de Stripe
CREATE TABLE public.payment_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  stripe_dispute_id TEXT UNIQUE NOT NULL,
  stripe_charge_id TEXT,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'mxn',
  reason TEXT,
  status TEXT NOT NULL,
  evidence_submitted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  notes TEXT
);

-- Índices para búsquedas frecuentes
CREATE INDEX idx_disputes_user ON public.payment_disputes(user_id);
CREATE INDEX idx_disputes_status ON public.payment_disputes(status);

-- Habilitar RLS
ALTER TABLE public.payment_disputes ENABLE ROW LEVEL SECURITY;

-- Política para admins (usando user_roles como el resto del sistema)
CREATE POLICY "Admins can manage disputes" 
ON public.payment_disputes
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('super_admin', 'moderator')
  )
);