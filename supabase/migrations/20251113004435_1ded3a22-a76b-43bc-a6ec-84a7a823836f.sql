-- Crear tabla para rastrear upsells activos de usuarios
CREATE TABLE IF NOT EXISTS public.user_active_upsells (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  upsell_id UUID NOT NULL REFERENCES public.upsells(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  quantity INTEGER NOT NULL DEFAULT 1,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE,
  auto_renew BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Índices para mejor rendimiento
CREATE INDEX idx_user_active_upsells_user_id ON public.user_active_upsells(user_id);
CREATE INDEX idx_user_active_upsells_status ON public.user_active_upsells(status);
CREATE INDEX idx_user_active_upsells_end_date ON public.user_active_upsells(end_date);

-- Trigger para updated_at
CREATE TRIGGER update_user_active_upsells_updated_at
  BEFORE UPDATE ON public.user_active_upsells
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- RLS Policies
ALTER TABLE public.user_active_upsells ENABLE ROW LEVEL SECURITY;

-- Usuarios pueden ver sus propios upsells activos
CREATE POLICY "Users can view own active upsells"
  ON public.user_active_upsells
  FOR SELECT
  USING (auth.uid() = user_id);

-- Sistema puede insertar upsells
CREATE POLICY "System can insert upsells"
  ON public.user_active_upsells
  FOR INSERT
  WITH CHECK (true);

-- Sistema puede actualizar upsells
CREATE POLICY "System can update upsells"
  ON public.user_active_upsells
  FOR UPDATE
  USING (true);

-- Usuarios pueden cancelar sus propios upsells (cambiar status)
CREATE POLICY "Users can cancel own upsells"
  ON public.user_active_upsells
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);