-- Create RPC function to increment coupon usage count
CREATE OR REPLACE FUNCTION public.increment_coupon_uses(p_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE promotion_coupons
  SET times_redeemed = COALESCE(times_redeemed, 0) + 1,
      updated_at = NOW()
  WHERE code = p_code;
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION public.increment_coupon_uses(TEXT) TO service_role;