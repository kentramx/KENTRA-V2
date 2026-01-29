-- =============================================================================
-- Migration: Document Required Cron Jobs for Subscription Management
--
-- NOTE: pg_cron is not available on Supabase Free tier.
-- Use external cron service (cron-job.org, Render, GitHub Actions) to call these endpoints.
--
-- CRITICAL P0: These cron jobs are REQUIRED for subscription system to work:
-- - Without them, trials never expire
-- - Past due subscriptions never get suspended
-- - Payment reminder emails are never sent
-- =============================================================================

-- Create a table to document required cron jobs for reference
CREATE TABLE IF NOT EXISTS required_cron_jobs (
  id SERIAL PRIMARY KEY,
  job_name TEXT NOT NULL UNIQUE,
  schedule TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  description TEXT,
  is_critical BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert required cron job definitions
INSERT INTO required_cron_jobs (job_name, schedule, endpoint, description, is_critical)
VALUES
  ('expire-trial-subscriptions', '0 2 * * *',
   'https://rxtmnbcewprzfgkvehsq.supabase.co/functions/v1/expire-trial-subscriptions',
   'Marks trial subscriptions as expired when period ends. Runs daily at 2:00 AM.',
   true),

  ('suspend-past-due-subscriptions', '0 3 * * *',
   'https://rxtmnbcewprzfgkvehsq.supabase.co/functions/v1/suspend-past-due-subscriptions',
   'Suspends subscriptions past_due for 7+ days and pauses properties. Runs daily at 3:00 AM.',
   true),

  ('send-payment-reminders', '0 */6 * * *',
   'https://rxtmnbcewprzfgkvehsq.supabase.co/functions/v1/send-payment-reminders',
   'Sends escalating payment reminder emails on days 3, 5, 7. Runs every 6 hours.',
   true),

  ('expire-incomplete-payments', '0 */2 * * *',
   'https://rxtmnbcewprzfgkvehsq.supabase.co/functions/v1/expire-incomplete-payments',
   'Expires OXXO/SPEI incomplete payments after 48 hours. Runs every 2 hours.',
   true),

  ('expire-upsells', '0 4 * * *',
   'https://rxtmnbcewprzfgkvehsq.supabase.co/functions/v1/expire-upsells',
   'Expires upsells (additional slots) that have ended. Runs daily at 4:00 AM.',
   false),

  ('send-renewal-reminders', '0 10 * * *',
   'https://rxtmnbcewprzfgkvehsq.supabase.co/functions/v1/send-renewal-reminder',
   'Sends reminders 3 days before subscription renewal. Runs daily at 10:00 AM.',
   false),

  ('refresh-materialized-views', '*/15 * * * *',
   'https://rxtmnbcewprzfgkvehsq.supabase.co/functions/v1/refresh-materialized-views',
   'Refreshes geohash cluster materialized views. Runs every 15 minutes.',
   false)

ON CONFLICT (job_name) DO UPDATE SET
  schedule = EXCLUDED.schedule,
  endpoint = EXCLUDED.endpoint,
  description = EXCLUDED.description,
  is_critical = EXCLUDED.is_critical;

-- Create function to get cron job setup instructions
CREATE OR REPLACE FUNCTION get_cron_setup_instructions()
RETURNS TABLE (
  job_name TEXT,
  cron_schedule TEXT,
  curl_command TEXT,
  is_critical BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.job_name,
    r.schedule,
    format(
      'curl -X POST "%s" -H "Content-Type: application/json" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"',
      r.endpoint
    ),
    r.is_critical
  FROM required_cron_jobs r
  ORDER BY r.is_critical DESC, r.job_name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE required_cron_jobs IS 'Documents required cron jobs. Use cron-job.org or similar to schedule these.';
COMMENT ON FUNCTION get_cron_setup_instructions IS 'Returns curl commands for setting up cron jobs externally.';
