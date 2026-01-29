-- =============================================================================
-- Migration: Implement RLS Policies for Subscription Tables
--
-- CRITICAL SECURITY FIX: These tables were missing RLS policies, allowing
-- potential unauthorized access to sensitive payment and subscription data.
-- =============================================================================

-- ============================================
-- 1. USER_SUBSCRIPTIONS TABLE
-- ============================================

-- Enable RLS
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own subscription" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON user_subscriptions;
DROP POLICY IF EXISTS "Service role has full access to subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON user_subscriptions;

-- Policy: Users can only view their own subscription
CREATE POLICY "Users can view own subscription"
  ON user_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can update their own subscription (limited fields via edge functions)
CREATE POLICY "Users can update own subscription"
  ON user_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Service role can do anything (for webhooks and admin)
CREATE POLICY "Service role has full access to subscriptions"
  ON user_subscriptions
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Admin users (super_admin role) can view all subscriptions
CREATE POLICY "Admins can view all subscriptions"
  ON user_subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- ============================================
-- 2. PAYMENT_HISTORY TABLE
-- ============================================

-- Enable RLS
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own payment history" ON payment_history;
DROP POLICY IF EXISTS "Service role can insert payment history" ON payment_history;
DROP POLICY IF EXISTS "Service role can update payment history" ON payment_history;
DROP POLICY IF EXISTS "Admins can view all payment history" ON payment_history;

-- Policy: Users can only view their own payment history
CREATE POLICY "Users can view own payment history"
  ON payment_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can insert payment records (webhooks)
CREATE POLICY "Service role can insert payment history"
  ON payment_history
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Service role can update payment records
CREATE POLICY "Service role can update payment history"
  ON payment_history
  FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Admins can view all payment history
CREATE POLICY "Admins can view all payment history"
  ON payment_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- ============================================
-- 3. USER_ACTIVE_UPSELLS TABLE
-- ============================================

-- Enable RLS
ALTER TABLE user_active_upsells ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own upsells" ON user_active_upsells;
DROP POLICY IF EXISTS "Service role has full access to upsells" ON user_active_upsells;
DROP POLICY IF EXISTS "Admins can view all upsells" ON user_active_upsells;

-- Policy: Users can view their own upsells
CREATE POLICY "Users can view own upsells"
  ON user_active_upsells
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can manage upsells (webhooks)
CREATE POLICY "Service role has full access to upsells"
  ON user_active_upsells
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Admins can view all upsells
CREATE POLICY "Admins can view all upsells"
  ON user_active_upsells
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- ============================================
-- 4. SUBSCRIPTION_CHANGES TABLE
-- ============================================

-- Enable RLS
ALTER TABLE subscription_changes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own subscription changes" ON subscription_changes;
DROP POLICY IF EXISTS "Service role can insert subscription changes" ON subscription_changes;
DROP POLICY IF EXISTS "Admins can view all subscription changes" ON subscription_changes;

-- Policy: Users can view their own subscription changes
CREATE POLICY "Users can view own subscription changes"
  ON subscription_changes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can insert changes (webhooks and edge functions)
CREATE POLICY "Service role can insert subscription changes"
  ON subscription_changes
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Admins can view all subscription changes
CREATE POLICY "Admins can view all subscription changes"
  ON subscription_changes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- ============================================
-- 5. STRIPE_WEBHOOK_EVENTS TABLE (PRIVATE)
-- ============================================

-- Enable RLS
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role only for webhook events" ON stripe_webhook_events;

-- Policy: Only service role can access webhook events
CREATE POLICY "Service role only for webhook events"
  ON stripe_webhook_events
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- 6. SUBSCRIPTION_PLANS TABLE (PUBLIC READ)
-- ============================================

-- Enable RLS (if not already)
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view active plans" ON subscription_plans;
DROP POLICY IF EXISTS "Service role can manage plans" ON subscription_plans;
DROP POLICY IF EXISTS "Admins can manage plans" ON subscription_plans;

-- Policy: Anyone can view active subscription plans
CREATE POLICY "Anyone can view active plans"
  ON subscription_plans
  FOR SELECT
  USING (is_active = true);

-- Policy: Service role can manage plans
CREATE POLICY "Service role can manage plans"
  ON subscription_plans
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Admins can manage plans
CREATE POLICY "Admins can manage plans"
  ON subscription_plans
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- ============================================
-- VERIFICATION: Check that RLS is enabled
-- ============================================
DO $$
DECLARE
  tables_without_rls TEXT[];
BEGIN
  SELECT array_agg(tablename::text)
  INTO tables_without_rls
  FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  WHERE t.schemaname = 'public'
    AND t.tablename IN ('user_subscriptions', 'payment_history', 'user_active_upsells',
                        'subscription_changes', 'stripe_webhook_events', 'subscription_plans')
    AND NOT c.relrowsecurity;

  IF tables_without_rls IS NOT NULL AND array_length(tables_without_rls, 1) > 0 THEN
    RAISE WARNING 'RLS not enabled on: %', tables_without_rls;
  ELSE
    RAISE NOTICE 'RLS enabled on all subscription tables';
  END IF;
END $$;
