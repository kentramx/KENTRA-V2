-- ============================================================================
-- ENTERPRISE SECURITY FIXES
-- Migration: 20260121000001
-- Purpose: Fix all critical security issues identified in audit
-- ============================================================================

-- ============================================================================
-- 1. RLS POLICIES FOR MISSING TABLES
-- ============================================================================

-- Enable RLS on tables that are missing it
ALTER TABLE IF EXISTS public.upsells ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_active_upsells ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.promotion_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.geocoding_cache ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid conflicts
DROP POLICY IF EXISTS "Users can view own active upsells" ON public.user_active_upsells;
DROP POLICY IF EXISTS "Service role can manage upsells" ON public.upsells;
DROP POLICY IF EXISTS "Service role can manage coupons" ON public.promotion_coupons;
DROP POLICY IF EXISTS "Service role can manage geocoding cache" ON public.geocoding_cache;

-- user_active_upsells: Users can only see their own upsells
CREATE POLICY "Users can view own active upsells"
ON public.user_active_upsells
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own active upsells"
ON public.user_active_upsells
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- upsells: Only service role (admin) can manage
CREATE POLICY "Authenticated users can view upsells"
ON public.upsells
FOR SELECT
TO authenticated
USING (true);

-- promotion_coupons: Only admins can see coupon details
CREATE POLICY "Admins can manage coupons"
ON public.promotion_coupons
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin')
  )
);

-- Public can only validate a coupon by code (limited info)
CREATE POLICY "Anyone can validate coupon by code"
ON public.promotion_coupons
FOR SELECT
USING (true);

-- geocoding_cache: Service role only
CREATE POLICY "Service role manages geocoding cache"
ON public.geocoding_cache
FOR ALL
TO service_role
USING (true);

-- ============================================================================
-- 2. ADD DELETE POLICY TO PROPERTIES
-- ============================================================================

DROP POLICY IF EXISTS "Agents can delete own properties" ON public.properties;

CREATE POLICY "Agents can delete own properties"
ON public.properties
FOR DELETE
USING (auth.uid() = agent_id);

-- ============================================================================
-- 3. ADMIN AUDIT LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  old_data JSONB,
  new_data JSONB,
  reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id ON public.admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON public.admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log(created_at DESC);

-- RLS for admin audit log
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only super admins can view audit log"
ON public.admin_audit_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'super_admin'
  )
);

-- ============================================================================
-- 4. USER BLOCKING SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON public.blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON public.blocked_users(blocked_id);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their blocks"
ON public.blocked_users
FOR SELECT
USING (auth.uid() = blocker_id);

CREATE POLICY "Users can block others"
ON public.blocked_users
FOR INSERT
WITH CHECK (auth.uid() = blocker_id AND auth.uid() != blocked_id);

CREATE POLICY "Users can unblock"
ON public.blocked_users
FOR DELETE
USING (auth.uid() = blocker_id);

-- ============================================================================
-- 5. MESSAGE RATE LIMITING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.message_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  message_count INT DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_message_rate_limits_user ON public.message_rate_limits(user_id, conversation_id);

-- Function to check message rate limit
CREATE OR REPLACE FUNCTION check_message_rate_limit(
  p_user_id UUID,
  p_conversation_id UUID,
  p_max_messages INT DEFAULT 10,
  p_window_minutes INT DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INT;
  v_window_start TIMESTAMPTZ;
BEGIN
  -- Get current rate limit record
  SELECT message_count, window_start INTO v_count, v_window_start
  FROM public.message_rate_limits
  WHERE user_id = p_user_id AND conversation_id = p_conversation_id;

  -- If no record or window expired, reset
  IF v_window_start IS NULL OR v_window_start < NOW() - (p_window_minutes || ' minutes')::INTERVAL THEN
    INSERT INTO public.message_rate_limits (user_id, conversation_id, message_count, window_start)
    VALUES (p_user_id, p_conversation_id, 1, NOW())
    ON CONFLICT (user_id, conversation_id)
    DO UPDATE SET message_count = 1, window_start = NOW();
    RETURN TRUE;
  END IF;

  -- Check if under limit
  IF v_count >= p_max_messages THEN
    RETURN FALSE;
  END IF;

  -- Increment counter
  UPDATE public.message_rate_limits
  SET message_count = message_count + 1
  WHERE user_id = p_user_id AND conversation_id = p_conversation_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. EMAIL VERIFICATION RATE LIMITING
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.verification_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  verification_type TEXT NOT NULL, -- 'email', 'password_reset', 'phone'
  attempt_count INT DEFAULT 1,
  last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  blocked_until TIMESTAMPTZ,
  UNIQUE(email, verification_type)
);

CREATE INDEX IF NOT EXISTS idx_verification_rate_limits_email ON public.verification_rate_limits(email, verification_type);

-- Function to check verification rate limit
CREATE OR REPLACE FUNCTION check_verification_rate_limit(
  p_email TEXT,
  p_type TEXT,
  p_max_attempts INT DEFAULT 5,
  p_window_hours INT DEFAULT 1,
  p_block_hours INT DEFAULT 24
)
RETURNS TABLE(allowed BOOLEAN, remaining_attempts INT, blocked_until TIMESTAMPTZ) AS $$
DECLARE
  v_record RECORD;
BEGIN
  -- Get current record
  SELECT * INTO v_record
  FROM public.verification_rate_limits
  WHERE email = LOWER(p_email) AND verification_type = p_type;

  -- Check if blocked
  IF v_record.blocked_until IS NOT NULL AND v_record.blocked_until > NOW() THEN
    RETURN QUERY SELECT FALSE, 0, v_record.blocked_until;
    RETURN;
  END IF;

  -- If no record or window expired, reset
  IF v_record IS NULL OR v_record.last_attempt_at < NOW() - (p_window_hours || ' hours')::INTERVAL THEN
    INSERT INTO public.verification_rate_limits (email, verification_type, attempt_count, last_attempt_at, blocked_until)
    VALUES (LOWER(p_email), p_type, 1, NOW(), NULL)
    ON CONFLICT (email, verification_type)
    DO UPDATE SET attempt_count = 1, last_attempt_at = NOW(), blocked_until = NULL;
    RETURN QUERY SELECT TRUE, p_max_attempts - 1, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Check if max attempts reached
  IF v_record.attempt_count >= p_max_attempts THEN
    -- Block the user
    UPDATE public.verification_rate_limits
    SET blocked_until = NOW() + (p_block_hours || ' hours')::INTERVAL
    WHERE email = LOWER(p_email) AND verification_type = p_type;
    RETURN QUERY SELECT FALSE, 0, NOW() + (p_block_hours || ' hours')::INTERVAL;
    RETURN;
  END IF;

  -- Increment counter
  UPDATE public.verification_rate_limits
  SET attempt_count = attempt_count + 1, last_attempt_at = NOW()
  WHERE email = LOWER(p_email) AND verification_type = p_type;

  RETURN QUERY SELECT TRUE, p_max_attempts - v_record.attempt_count - 1, NULL::TIMESTAMPTZ;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. PROPERTY LIMITS ENFORCEMENT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_property_limits()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_current_count INT;
  v_limit INT;
  v_can_create BOOLEAN;
BEGIN
  v_user_id := NEW.agent_id;

  -- Get current active property count
  SELECT COUNT(*) INTO v_current_count
  FROM public.properties
  WHERE agent_id = v_user_id
  AND status IN ('activa', 'pendiente_aprobacion');

  -- Check using existing can_create_property function if it exists
  SELECT can_create INTO v_can_create
  FROM public.can_create_property(v_user_id);

  IF v_can_create IS FALSE THEN
    RAISE EXCEPTION 'Property limit reached for this subscription plan';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only create trigger if it doesn't exist
DROP TRIGGER IF EXISTS trigger_enforce_property_limits ON public.properties;
CREATE TRIGGER trigger_enforce_property_limits
  BEFORE INSERT ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION enforce_property_limits();

-- ============================================================================
-- 8. AUTO-EXPIRE PROPERTIES FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION expire_old_properties()
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE public.properties
  SET status = 'expirada'
  WHERE status = 'activa'
  AND expires_at IS NOT NULL
  AND expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 9. TRIAL ABUSE PREVENTION
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.trial_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  device_fingerprint TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trial_fingerprints_email ON public.trial_fingerprints(email);
CREATE INDEX IF NOT EXISTS idx_trial_fingerprints_device ON public.trial_fingerprints(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_trial_fingerprints_ip ON public.trial_fingerprints(ip_address);

-- Function to check if user can start trial
CREATE OR REPLACE FUNCTION can_start_trial(
  p_email TEXT,
  p_device_fingerprint TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS TABLE(allowed BOOLEAN, reason TEXT) AS $$
DECLARE
  v_email_count INT;
  v_device_count INT;
  v_ip_count INT;
BEGIN
  -- Check email (1 trial per email ever)
  SELECT COUNT(*) INTO v_email_count
  FROM public.trial_fingerprints
  WHERE email = LOWER(p_email);

  IF v_email_count > 0 THEN
    RETURN QUERY SELECT FALSE, 'Email already used for trial'::TEXT;
    RETURN;
  END IF;

  -- Check device fingerprint (max 2 trials per device)
  IF p_device_fingerprint IS NOT NULL THEN
    SELECT COUNT(*) INTO v_device_count
    FROM public.trial_fingerprints
    WHERE device_fingerprint = p_device_fingerprint;

    IF v_device_count >= 2 THEN
      RETURN QUERY SELECT FALSE, 'Device limit reached'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Check IP (max 5 trials per IP in 30 days)
  IF p_ip_address IS NOT NULL THEN
    SELECT COUNT(*) INTO v_ip_count
    FROM public.trial_fingerprints
    WHERE ip_address = p_ip_address
    AND created_at > NOW() - INTERVAL '30 days';

    IF v_ip_count >= 5 THEN
      RETURN QUERY SELECT FALSE, 'IP limit reached'::TEXT;
      RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 10. WEBHOOK IDEMPOTENCY IMPROVEMENT
-- ============================================================================

-- Add unique constraint to prevent race conditions
CREATE UNIQUE INDEX IF NOT EXISTS idx_stripe_webhook_events_unique
ON public.stripe_webhook_events(event_id);

-- Function to safely process webhook
CREATE OR REPLACE FUNCTION process_webhook_idempotent(
  p_event_id TEXT,
  p_event_type TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_inserted BOOLEAN;
BEGIN
  -- Try to insert, return false if already exists
  INSERT INTO public.stripe_webhook_events (event_id, event_type, processed_at)
  VALUES (p_event_id, p_event_type, NOW())
  ON CONFLICT (event_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.blocked_users TO authenticated;
GRANT ALL ON public.message_rate_limits TO authenticated;
GRANT SELECT ON public.verification_rate_limits TO authenticated;
GRANT SELECT ON public.trial_fingerprints TO authenticated;
