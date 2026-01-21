-- ============================================================================
-- MESSAGE RATE LIMIT TRIGGER
-- Migration: 20260121065000
-- Purpose: Enforce message rate limiting at the database level
-- ============================================================================

-- Create trigger function that enforces rate limiting
CREATE OR REPLACE FUNCTION enforce_message_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_allowed BOOLEAN;
  v_max_messages INT := 20;  -- Max 20 messages per minute per conversation
  v_window_minutes INT := 1;
BEGIN
  -- Check rate limit
  SELECT check_message_rate_limit(
    NEW.sender_id,
    NEW.conversation_id,
    v_max_messages,
    v_window_minutes
  ) INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before sending more messages.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_message_rate_limit ON public.messages;

-- Create the trigger
CREATE TRIGGER trigger_message_rate_limit
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION enforce_message_rate_limit();

-- Add RLS policy for message_rate_limits table
ALTER TABLE IF EXISTS public.message_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own rate limits" ON public.message_rate_limits;
CREATE POLICY "Users can view own rate limits"
ON public.message_rate_limits
FOR SELECT
USING (auth.uid() = user_id);

-- Clean up old rate limit records (older than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  DELETE FROM public.message_rate_limits
  WHERE window_start < NOW() - INTERVAL '1 hour';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION enforce_message_rate_limit() IS 'Enforces rate limiting on message sending - 20 messages per minute per conversation';
COMMENT ON FUNCTION cleanup_old_rate_limits() IS 'Cleans up expired rate limit records to prevent table bloat';
