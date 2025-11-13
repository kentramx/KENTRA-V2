-- Tabla para trackear cupones y su uso
CREATE TABLE IF NOT EXISTS public.promotion_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_coupon_id TEXT NOT NULL UNIQUE,
  stripe_promotion_code_id TEXT UNIQUE,
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value NUMERIC NOT NULL,
  currency TEXT DEFAULT 'mxn',
  max_redemptions INTEGER,
  times_redeemed INTEGER DEFAULT 0,
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  applies_to TEXT DEFAULT 'all' CHECK (applies_to IN ('all', 'agent', 'agency', 'developer')),
  campaign_name TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla para trackear uso de cupones por usuario
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID REFERENCES public.promotion_coupons(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_session_id TEXT,
  discount_amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'mxn',
  plan_id UUID REFERENCES public.subscription_plans(id),
  redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(coupon_id, user_id)
);

-- RLS policies para promotion_coupons
ALTER TABLE public.promotion_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage all coupons"
ON public.promotion_coupons
FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Users can view active coupons"
ON public.promotion_coupons
FOR SELECT
USING (is_active = true AND (valid_until IS NULL OR valid_until > NOW()));

-- RLS policies para coupon_redemptions
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all redemptions"
ON public.coupon_redemptions
FOR SELECT
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own redemptions"
ON public.coupon_redemptions
FOR SELECT
USING (auth.uid() = user_id);

-- Función para validar y aplicar cupón
CREATE OR REPLACE FUNCTION public.validate_coupon(
  p_code TEXT,
  p_user_id UUID,
  p_plan_type TEXT DEFAULT NULL
)
RETURNS TABLE(
  is_valid BOOLEAN,
  coupon_id UUID,
  stripe_coupon_id TEXT,
  discount_type TEXT,
  discount_value NUMERIC,
  message TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon RECORD;
  v_already_used BOOLEAN;
BEGIN
  -- Buscar cupón activo
  SELECT * INTO v_coupon
  FROM promotion_coupons
  WHERE code = p_code
    AND is_active = true
    AND (valid_from IS NULL OR valid_from <= NOW())
    AND (valid_until IS NULL OR valid_until > NOW())
    AND (max_redemptions IS NULL OR times_redeemed < max_redemptions)
    AND (applies_to = 'all' OR applies_to = p_plan_type);
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::NUMERIC, 
      'Cupón inválido, expirado o no disponible'::TEXT;
    RETURN;
  END IF;
  
  -- Verificar si el usuario ya usó este cupón
  SELECT EXISTS(
    SELECT 1 FROM coupon_redemptions 
    WHERE coupon_id = v_coupon.id AND user_id = p_user_id
  ) INTO v_already_used;
  
  IF v_already_used THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::NUMERIC,
      'Ya has usado este cupón anteriormente'::TEXT;
    RETURN;
  END IF;
  
  -- Cupón válido
  RETURN QUERY SELECT 
    true,
    v_coupon.id,
    v_coupon.stripe_coupon_id,
    v_coupon.discount_type,
    v_coupon.discount_value,
    format('Descuento aplicado: %s%s', 
      CASE 
        WHEN v_coupon.discount_type = 'percentage' THEN v_coupon.discount_value || '%'
        ELSE '$' || v_coupon.discount_value || ' ' || UPPER(v_coupon.currency)
      END,
      ''
    )::TEXT;
END;
$$;

-- Índices para optimización
CREATE INDEX idx_promotion_coupons_code ON public.promotion_coupons(code);
CREATE INDEX idx_promotion_coupons_active ON public.promotion_coupons(is_active, valid_until);
CREATE INDEX idx_coupon_redemptions_user ON public.coupon_redemptions(user_id);
CREATE INDEX idx_coupon_redemptions_coupon ON public.coupon_redemptions(coupon_id);

-- Trigger para updated_at
CREATE TRIGGER update_promotion_coupons_updated_at
BEFORE UPDATE ON public.promotion_coupons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();