-- Security Audit Logs Table
-- Stores security-relevant events for compliance and monitoring

CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying by user
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.security_audit_logs(user_id);

-- Index for querying by event type
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON public.security_audit_logs(event_type);

-- Index for querying by IP (for security investigations)
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON public.security_audit_logs(ip_address);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.security_audit_logs(created_at DESC);

-- Composite index for common query pattern (user + time)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_time ON public.security_audit_logs(user_id, created_at DESC);

-- RLS: Only admins can read audit logs
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- No public access - only service role can insert
CREATE POLICY "Service role can insert audit logs"
  ON public.security_audit_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Admins can read (for admin panel)
CREATE POLICY "Admins can read audit logs"
  ON public.security_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Comment for documentation
COMMENT ON TABLE public.security_audit_logs IS 'Security audit trail for compliance and monitoring';
COMMENT ON COLUMN public.security_audit_logs.event_type IS 'Type of security event (auth.login.success, auth.password_change, etc.)';
COMMENT ON COLUMN public.security_audit_logs.metadata IS 'Additional event-specific data (never contains sensitive info)';
