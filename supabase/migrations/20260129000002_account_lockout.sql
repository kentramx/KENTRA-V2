-- Account Lockout Mechanism
-- Server-side tracking of failed login attempts for brute force protection

-- Table to track failed login attempts
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying by email (most common lookup)
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON public.login_attempts(email);

-- Index for time-based cleanup
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON public.login_attempts(created_at DESC);

-- Composite index for rate limiting queries
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time ON public.login_attempts(email, created_at DESC);

-- RLS: Only service role can insert/read
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage login attempts"
  ON public.login_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Account lockout status table
CREATE TABLE IF NOT EXISTS public.account_lockouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ NOT NULL,
  unlock_token_hash TEXT,
  unlock_token_expires_at TIMESTAMPTZ,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_lockouts_email ON public.account_lockouts(email);
CREATE INDEX IF NOT EXISTS idx_account_lockouts_locked_until ON public.account_lockouts(locked_until);

ALTER TABLE public.account_lockouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage account lockouts"
  ON public.account_lockouts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to check if account is locked
CREATE OR REPLACE FUNCTION public.check_account_lockout(
  p_email TEXT
)
RETURNS TABLE(
  is_locked BOOLEAN,
  locked_until TIMESTAMPTZ,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (al.locked_until > now()) as is_locked,
    al.locked_until,
    al.reason
  FROM public.account_lockouts al
  WHERE al.email = lower(trim(p_email))
  AND al.locked_until > now()
  LIMIT 1;

  -- Return empty row if no lockout found
  IF NOT FOUND THEN
    RETURN QUERY SELECT false::boolean, null::timestamptz, null::text;
  END IF;
END;
$$;

-- Function to record login attempt and check for lockout
CREATE OR REPLACE FUNCTION public.record_login_attempt(
  p_email TEXT,
  p_ip_address TEXT,
  p_success BOOLEAN,
  p_failure_reason TEXT DEFAULT NULL,
  p_max_attempts INTEGER DEFAULT 5,
  p_lockout_minutes INTEGER DEFAULT 15
)
RETURNS TABLE(
  should_lock BOOLEAN,
  attempt_count INTEGER,
  locked_until TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
  v_attempt_count INTEGER;
  v_should_lock BOOLEAN := false;
  v_locked_until TIMESTAMPTZ;
BEGIN
  v_email := lower(trim(p_email));

  -- Record the attempt
  INSERT INTO public.login_attempts (email, ip_address, success, failure_reason)
  VALUES (v_email, p_ip_address, p_success, p_failure_reason);

  -- If successful, clear any existing lockout
  IF p_success THEN
    DELETE FROM public.account_lockouts WHERE email = v_email;
    RETURN QUERY SELECT false, 0, null::timestamptz;
    RETURN;
  END IF;

  -- Count failed attempts in the last hour
  SELECT COUNT(*)
  INTO v_attempt_count
  FROM public.login_attempts
  WHERE email = v_email
    AND success = false
    AND created_at > now() - interval '1 hour';

  -- Check if we should lock
  IF v_attempt_count >= p_max_attempts THEN
    v_should_lock := true;
    v_locked_until := now() + (p_lockout_minutes * interval '1 minute');

    -- Create or update lockout record
    INSERT INTO public.account_lockouts (email, locked_until, reason)
    VALUES (v_email, v_locked_until, 'Too many failed login attempts')
    ON CONFLICT (email) DO UPDATE
    SET
      locked_until = EXCLUDED.locked_until,
      reason = EXCLUDED.reason,
      updated_at = now();
  END IF;

  RETURN QUERY SELECT v_should_lock, v_attempt_count, v_locked_until;
END;
$$;

-- Function to unlock account (for admin use or email verification)
CREATE OR REPLACE FUNCTION public.unlock_account(
  p_email TEXT,
  p_unlock_token TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
  v_lockout RECORD;
  v_token_hash TEXT;
BEGIN
  v_email := lower(trim(p_email));

  -- Get lockout record
  SELECT * INTO v_lockout
  FROM public.account_lockouts
  WHERE email = v_email;

  IF NOT FOUND THEN
    RETURN true; -- Not locked
  END IF;

  -- If token provided, verify it
  IF p_unlock_token IS NOT NULL THEN
    -- Hash the provided token
    v_token_hash := encode(sha256(p_unlock_token::bytea), 'hex');

    IF v_lockout.unlock_token_hash IS NULL OR
       v_lockout.unlock_token_hash != v_token_hash OR
       v_lockout.unlock_token_expires_at < now() THEN
      RETURN false; -- Invalid token
    END IF;
  END IF;

  -- Clear lockout
  DELETE FROM public.account_lockouts WHERE email = v_email;

  -- Clear recent failed attempts
  DELETE FROM public.login_attempts
  WHERE email = v_email
    AND success = false
    AND created_at > now() - interval '1 hour';

  RETURN true;
END;
$$;

-- Cleanup function for old data (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_login_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete attempts older than 7 days
  DELETE FROM public.login_attempts
  WHERE created_at < now() - interval '7 days';

  -- Delete expired lockouts
  DELETE FROM public.account_lockouts
  WHERE locked_until < now() - interval '1 day';
END;
$$;

-- Comments
COMMENT ON TABLE public.login_attempts IS 'Tracks login attempts for brute force protection';
COMMENT ON TABLE public.account_lockouts IS 'Tracks account lockouts after too many failed attempts';
COMMENT ON FUNCTION public.check_account_lockout IS 'Check if an account is currently locked';
COMMENT ON FUNCTION public.record_login_attempt IS 'Record a login attempt and check for lockout';
COMMENT ON FUNCTION public.unlock_account IS 'Unlock a locked account';
