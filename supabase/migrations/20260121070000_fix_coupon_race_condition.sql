-- ============================================================================
-- FIX COUPON REDEMPTION RACE CONDITION
-- Migration: 20260121070000
-- Purpose: Prevent coupons from being used beyond their max_redemptions limit
-- ============================================================================

-- Create a function to atomically validate and reserve a coupon redemption
CREATE OR REPLACE FUNCTION redeem_coupon_atomic(
  p_coupon_id UUID,
  p_user_id UUID,
  p_stripe_session_id TEXT,
  p_discount_amount NUMERIC,
  p_currency TEXT DEFAULT 'mxn',
  p_plan_id UUID DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, message TEXT, redemption_id UUID) AS $$
DECLARE
  v_coupon RECORD;
  v_redemption_id UUID;
BEGIN
  -- Lock the coupon row to prevent race condition
  SELECT * INTO v_coupon
  FROM public.promotion_coupons
  WHERE id = p_coupon_id
  FOR UPDATE;

  -- Check if coupon exists
  IF v_coupon IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Cupón no encontrado'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Check if coupon is active
  IF NOT v_coupon.is_active THEN
    RETURN QUERY SELECT FALSE, 'Cupón inactivo'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Check if max redemptions reached
  IF v_coupon.max_redemptions IS NOT NULL AND v_coupon.times_redeemed >= v_coupon.max_redemptions THEN
    RETURN QUERY SELECT FALSE, 'Cupón agotado - máximo de usos alcanzado'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Check if user already used this coupon
  IF EXISTS (
    SELECT 1 FROM public.coupon_redemptions
    WHERE coupon_id = p_coupon_id AND user_id = p_user_id
  ) THEN
    RETURN QUERY SELECT FALSE, 'Ya has usado este cupón'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Check validity period
  IF v_coupon.valid_from IS NOT NULL AND v_coupon.valid_from > NOW() THEN
    RETURN QUERY SELECT FALSE, 'Cupón aún no válido'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < NOW() THEN
    RETURN QUERY SELECT FALSE, 'Cupón expirado'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- All checks passed - atomically increment counter and create redemption
  -- This is done in a single transaction so both succeed or both fail

  -- Increment redemption count
  UPDATE public.promotion_coupons
  SET times_redeemed = times_redeemed + 1
  WHERE id = p_coupon_id;

  -- Create redemption record
  INSERT INTO public.coupon_redemptions (
    coupon_id,
    user_id,
    stripe_session_id,
    discount_amount,
    currency,
    plan_id
  ) VALUES (
    p_coupon_id,
    p_user_id,
    p_stripe_session_id,
    p_discount_amount,
    p_currency,
    p_plan_id
  )
  RETURNING id INTO v_redemption_id;

  RETURN QUERY SELECT TRUE, 'Cupón aplicado correctamente'::TEXT, v_redemption_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to enforce max_redemptions at the database level
CREATE OR REPLACE FUNCTION check_coupon_max_redemptions()
RETURNS TRIGGER AS $$
DECLARE
  v_coupon RECORD;
BEGIN
  -- Get coupon with lock
  SELECT * INTO v_coupon
  FROM public.promotion_coupons
  WHERE id = NEW.coupon_id
  FOR UPDATE;

  -- If coupon has max_redemptions and we've reached it, reject
  IF v_coupon.max_redemptions IS NOT NULL THEN
    -- Count existing redemptions
    IF v_coupon.times_redeemed >= v_coupon.max_redemptions THEN
      RAISE EXCEPTION 'Coupon max redemptions limit reached'
        USING ERRCODE = 'P0003';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_check_coupon_limit ON public.coupon_redemptions;

-- Create the trigger
CREATE TRIGGER trigger_check_coupon_limit
  BEFORE INSERT ON public.coupon_redemptions
  FOR EACH ROW
  EXECUTE FUNCTION check_coupon_max_redemptions();

-- Grant execute on the atomic function
GRANT EXECUTE ON FUNCTION redeem_coupon_atomic(UUID, UUID, TEXT, NUMERIC, TEXT, UUID) TO authenticated;

COMMENT ON FUNCTION redeem_coupon_atomic IS 'Atomically validates and redeems a coupon, preventing race conditions';
COMMENT ON FUNCTION check_coupon_max_redemptions IS 'Trigger function to enforce coupon max_redemptions limit';
