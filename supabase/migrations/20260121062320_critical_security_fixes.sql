-- ============================================================================
-- CRITICAL SECURITY FIXES - Enterprise Audit Remediation
-- Date: 2026-01-21
-- Description: Addresses critical security issues identified in enterprise audit
-- ============================================================================

-- ============================================================================
-- 1. MISSING INDEXES - Performance Critical
-- ============================================================================

-- Index on properties.agent_id for faster agent lookups
CREATE INDEX IF NOT EXISTS idx_properties_agent_id ON properties(agent_id);

-- Index on properties for map queries with status filter
CREATE INDEX IF NOT EXISTS idx_properties_status_location ON properties(status, lat, lng)
  WHERE status = 'published';

-- Composite index for property searches
CREATE INDEX IF NOT EXISTS idx_properties_listing_search ON properties(listing_type, property_type, status)
  WHERE status = 'published';

-- Index for messages lookup
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, receiver_id, created_at DESC);

-- Index for user_subscriptions lookups
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe ON user_subscriptions(stripe_subscription_id);

-- Index for favorites user lookup
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);

-- Index for property views analytics
CREATE INDEX IF NOT EXISTS idx_property_views_property ON property_views(property_id, viewed_at DESC);

-- Index for webhook events
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_id ON stripe_webhook_events(event_id);

-- ============================================================================
-- 2. STRIPE WEBHOOK EVENTS - Add processed_at column for idempotency tracking
-- ============================================================================

ALTER TABLE stripe_webhook_events
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ DEFAULT NULL;

-- ============================================================================
-- 3. ADMIN AUDIT LOG TABLE - For tracking admin actions
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on admin_audit_log
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only super_admins can view audit log
CREATE POLICY "Super admins can view audit log"
  ON admin_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- Service role can insert (from Edge Functions)
CREATE POLICY "Service role can insert audit log"
  ON admin_audit_log FOR INSERT
  WITH CHECK (true);

-- Index for audit log queries
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin ON admin_audit_log(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON admin_audit_log(action, created_at DESC);

-- ============================================================================
-- 4. PAYMENT DISPUTES TABLE - For tracking chargebacks
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_dispute_id TEXT UNIQUE NOT NULL,
  stripe_charge_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'mxn',
  reason TEXT,
  status TEXT DEFAULT 'open',
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on payment_disputes
ALTER TABLE payment_disputes ENABLE ROW LEVEL SECURITY;

-- Only super_admins can view disputes
CREATE POLICY "Super admins can view disputes"
  ON payment_disputes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- Index for disputes
CREATE INDEX IF NOT EXISTS idx_payment_disputes_user ON payment_disputes(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_status ON payment_disputes(status) WHERE status = 'open';

-- ============================================================================
-- 5. PROPERTY_TILES_CACHE RLS - Add missing policies
-- ============================================================================

-- Enable RLS if not already enabled
ALTER TABLE property_tiles_cache ENABLE ROW LEVEL SECURITY;

-- Public read access for map tiles (they contain aggregated data only)
DROP POLICY IF EXISTS "Anyone can read property tiles" ON property_tiles_cache;
CREATE POLICY "Anyone can read property tiles"
  ON property_tiles_cache FOR SELECT
  USING (true);

-- Only service role can modify tiles (from Edge Functions/scheduled jobs)
DROP POLICY IF EXISTS "Service role can manage tiles" ON property_tiles_cache;
CREATE POLICY "Service role can manage tiles"
  ON property_tiles_cache FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- 6. MESSAGES TABLE - Add missing DELETE and UPDATE policies
-- ============================================================================

-- Allow users to delete their own sent messages (within time limit)
DROP POLICY IF EXISTS "Users can delete own messages" ON messages;
CREATE POLICY "Users can delete own messages"
  ON messages FOR DELETE
  USING (
    sender_id = auth.uid()
    AND created_at > NOW() - INTERVAL '5 minutes'
  );

-- Allow users to update their own messages (mark as read)
DROP POLICY IF EXISTS "Users can update received messages" ON messages;
CREATE POLICY "Users can update received messages"
  ON messages FOR UPDATE
  USING (receiver_id = auth.uid())
  WITH CHECK (receiver_id = auth.uid());

-- ============================================================================
-- 7. FIX SECURITY DEFINER FUNCTIONS - Add search_path
-- ============================================================================

-- Recreate is_super_admin with search_path
CREATE OR REPLACE FUNCTION is_super_admin(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = user_uuid AND role = 'super_admin'
  );
END;
$$;

-- Recreate has_admin_access with search_path
CREATE OR REPLACE FUNCTION has_admin_access(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = user_uuid AND role IN ('super_admin', 'moderator')
  );
END;
$$;

-- Recreate get_user_id_by_email with search_path
CREATE OR REPLACE FUNCTION get_user_id_by_email(user_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  found_user_id UUID;
BEGIN
  SELECT id INTO found_user_id
  FROM auth.users
  WHERE email = LOWER(user_email)
  LIMIT 1;

  RETURN found_user_id;
END;
$$;

-- ============================================================================
-- 8. SOFT DELETE SUPPORT FOR PROPERTIES
-- ============================================================================

-- Add deleted_at column for soft delete
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add deleted_by column to track who deleted
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL;

-- Update the default RLS policies to exclude soft-deleted properties
DROP POLICY IF EXISTS "Anyone can view published properties" ON properties;
CREATE POLICY "Anyone can view published properties"
  ON properties FOR SELECT
  USING (
    status = 'published'
    AND deleted_at IS NULL
  );

-- Index for excluding deleted properties
CREATE INDEX IF NOT EXISTS idx_properties_not_deleted ON properties(id) WHERE deleted_at IS NULL;

-- ============================================================================
-- 9. RATE LIMITING TABLE FOR DISTRIBUTED RATE LIMITING
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_limit_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint for key per window
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limit_key_window
  ON rate_limit_entries(key, window_start);

-- Auto-cleanup index
CREATE INDEX IF NOT EXISTS idx_rate_limit_expires
  ON rate_limit_entries(expires_at);

-- Function to check rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_max_requests INTEGER,
  p_window_seconds INTEGER
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, reset_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_current_count INTEGER;
  v_expires_at TIMESTAMPTZ;
BEGIN
  v_window_start := date_trunc('second', NOW() - (EXTRACT(EPOCH FROM NOW())::INTEGER % p_window_seconds) * INTERVAL '1 second');
  v_expires_at := v_window_start + (p_window_seconds * INTERVAL '1 second');

  -- Try to insert or update atomically
  INSERT INTO rate_limit_entries (key, count, window_start, expires_at)
  VALUES (p_key, 1, v_window_start, v_expires_at)
  ON CONFLICT (key, window_start)
  DO UPDATE SET count = rate_limit_entries.count + 1
  RETURNING count INTO v_current_count;

  allowed := v_current_count <= p_max_requests;
  remaining := GREATEST(0, p_max_requests - v_current_count);
  reset_at := v_expires_at;

  RETURN NEXT;
END;
$$;

-- Cleanup job for expired entries (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM rate_limit_entries
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ============================================================================
-- 10. GRANT NECESSARY PERMISSIONS
-- ============================================================================

-- Grant execute on rate limit function to authenticated users
GRANT EXECUTE ON FUNCTION check_rate_limit TO authenticated;

-- Grant usage on sequences if any
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- DONE
-- ============================================================================
