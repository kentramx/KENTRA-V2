-- ============================================================================
-- BLOCKING ENFORCEMENT
-- Migration: 20260121065500
-- Purpose: Prevent blocked users from interacting with each other
-- ============================================================================

-- Function to check if users are blocked from each other
CREATE OR REPLACE FUNCTION is_user_blocked(p_user_id UUID, p_other_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE (blocker_id = p_user_id AND blocked_id = p_other_user_id)
       OR (blocker_id = p_other_user_id AND blocked_id = p_user_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Trigger to prevent messages to/from blocked users
CREATE OR REPLACE FUNCTION enforce_message_blocking()
RETURNS TRIGGER AS $$
DECLARE
  v_other_user_id UUID;
  v_conversation RECORD;
BEGIN
  -- Get the conversation to find the other participant
  SELECT buyer_id, agent_id INTO v_conversation
  FROM public.conversations
  WHERE id = NEW.conversation_id;

  -- Determine who the other user is
  IF v_conversation.buyer_id = NEW.sender_id THEN
    v_other_user_id := v_conversation.agent_id;
  ELSE
    v_other_user_id := v_conversation.buyer_id;
  END IF;

  -- Check if blocked
  IF is_user_blocked(NEW.sender_id, v_other_user_id) THEN
    RAISE EXCEPTION 'Cannot send message - user is blocked'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_message_blocking ON public.messages;

-- Create the trigger (runs BEFORE insert, after rate limit check)
CREATE TRIGGER trigger_message_blocking
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION enforce_message_blocking();

-- Trigger to prevent conversation creation with blocked users
CREATE OR REPLACE FUNCTION enforce_conversation_blocking()
RETURNS TRIGGER AS $$
BEGIN
  IF is_user_blocked(NEW.buyer_id, NEW.agent_id) THEN
    RAISE EXCEPTION 'Cannot start conversation - user is blocked'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_conversation_blocking ON public.conversations;

-- Create the trigger
CREATE TRIGGER trigger_conversation_blocking
  BEFORE INSERT ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION enforce_conversation_blocking();

-- Function to block a user (with validation)
CREATE OR REPLACE FUNCTION block_user(p_user_id_to_block UUID, p_reason TEXT DEFAULT NULL)
RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
DECLARE
  v_current_user UUID;
BEGIN
  v_current_user := auth.uid();

  -- Cannot block yourself
  IF v_current_user = p_user_id_to_block THEN
    RETURN QUERY SELECT FALSE, 'Cannot block yourself'::TEXT;
    RETURN;
  END IF;

  -- Check if already blocked
  IF EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE blocker_id = v_current_user AND blocked_id = p_user_id_to_block
  ) THEN
    RETURN QUERY SELECT FALSE, 'User is already blocked'::TEXT;
    RETURN;
  END IF;

  -- Insert block record
  INSERT INTO public.blocked_users (blocker_id, blocked_id, reason)
  VALUES (v_current_user, p_user_id_to_block, p_reason);

  RETURN QUERY SELECT TRUE, 'User blocked successfully'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to unblock a user
CREATE OR REPLACE FUNCTION unblock_user(p_user_id_to_unblock UUID)
RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
DECLARE
  v_current_user UUID;
BEGIN
  v_current_user := auth.uid();

  DELETE FROM public.blocked_users
  WHERE blocker_id = v_current_user AND blocked_id = p_user_id_to_unblock;

  IF FOUND THEN
    RETURN QUERY SELECT TRUE, 'User unblocked successfully'::TEXT;
  ELSE
    RETURN QUERY SELECT FALSE, 'User was not blocked'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get list of blocked users
CREATE OR REPLACE FUNCTION get_blocked_users()
RETURNS TABLE(
  blocked_id UUID,
  blocked_at TIMESTAMPTZ,
  reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT bu.blocked_id, bu.created_at, bu.reason
  FROM public.blocked_users bu
  WHERE bu.blocker_id = auth.uid()
  ORDER BY bu.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_user_blocked(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION block_user(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION unblock_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_blocked_users() TO authenticated;

COMMENT ON FUNCTION is_user_blocked(UUID, UUID) IS 'Checks if two users have blocked each other (bidirectional)';
COMMENT ON FUNCTION block_user(UUID, TEXT) IS 'Blocks a user with optional reason';
COMMENT ON FUNCTION unblock_user(UUID) IS 'Unblocks a previously blocked user';
COMMENT ON FUNCTION get_blocked_users() IS 'Returns list of users blocked by the current user';
