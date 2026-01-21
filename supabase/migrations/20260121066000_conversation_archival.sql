-- ============================================================================
-- CONVERSATION ARCHIVAL
-- Migration: 20260121066000
-- Purpose: Allow users to archive conversations without deleting them
-- ============================================================================

-- Add archived columns to conversation_participants
ALTER TABLE public.conversation_participants
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id) DEFAULT NULL;

-- Create index for archived conversations
CREATE INDEX IF NOT EXISTS idx_conversation_participants_archived
ON public.conversation_participants(user_id, archived_at)
WHERE archived_at IS NOT NULL;

-- Function to archive a conversation
CREATE OR REPLACE FUNCTION archive_conversation(p_conversation_id UUID)
RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
DECLARE
  v_current_user UUID;
BEGIN
  v_current_user := auth.uid();

  -- Check if user is participant
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id AND user_id = v_current_user
  ) THEN
    RETURN QUERY SELECT FALSE, 'Not a participant of this conversation'::TEXT;
    RETURN;
  END IF;

  -- Check if already archived
  IF EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id
    AND user_id = v_current_user
    AND archived_at IS NOT NULL
  ) THEN
    RETURN QUERY SELECT FALSE, 'Conversation is already archived'::TEXT;
    RETURN;
  END IF;

  -- Archive the conversation for this user only
  UPDATE public.conversation_participants
  SET archived_at = NOW(), archived_by = v_current_user
  WHERE conversation_id = p_conversation_id AND user_id = v_current_user;

  RETURN QUERY SELECT TRUE, 'Conversation archived successfully'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to unarchive a conversation
CREATE OR REPLACE FUNCTION unarchive_conversation(p_conversation_id UUID)
RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
DECLARE
  v_current_user UUID;
BEGIN
  v_current_user := auth.uid();

  -- Check if user is participant
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id AND user_id = v_current_user
  ) THEN
    RETURN QUERY SELECT FALSE, 'Not a participant of this conversation'::TEXT;
    RETURN;
  END IF;

  -- Unarchive
  UPDATE public.conversation_participants
  SET archived_at = NULL, archived_by = NULL
  WHERE conversation_id = p_conversation_id AND user_id = v_current_user;

  IF FOUND THEN
    RETURN QUERY SELECT TRUE, 'Conversation unarchived successfully'::TEXT;
  ELSE
    RETURN QUERY SELECT FALSE, 'Conversation was not archived'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get archived conversations
CREATE OR REPLACE FUNCTION get_archived_conversations()
RETURNS TABLE(
  conversation_id UUID,
  property_id UUID,
  other_user_id UUID,
  archived_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ
) AS $$
DECLARE
  v_current_user UUID;
BEGIN
  v_current_user := auth.uid();

  RETURN QUERY
  SELECT
    c.id,
    c.property_id,
    CASE
      WHEN c.buyer_id = v_current_user THEN c.agent_id
      ELSE c.buyer_id
    END,
    cp.archived_at,
    c.updated_at
  FROM public.conversations c
  JOIN public.conversation_participants cp ON c.id = cp.conversation_id
  WHERE cp.user_id = v_current_user
  AND cp.archived_at IS NOT NULL
  ORDER BY cp.archived_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Update RLS policy to filter archived conversations from default view
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;

CREATE POLICY "Users can view own non-archived conversations"
ON public.conversations
FOR SELECT
USING (
  (auth.uid() = buyer_id OR auth.uid() = agent_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversations.id
    AND cp.user_id = auth.uid()
    AND cp.archived_at IS NOT NULL
  )
);

-- Policy to allow viewing archived conversations explicitly
CREATE POLICY "Users can view own archived conversations"
ON public.conversations
FOR SELECT
USING (
  (auth.uid() = buyer_id OR auth.uid() = agent_id)
  AND EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversations.id
    AND cp.user_id = auth.uid()
    AND cp.archived_at IS NOT NULL
  )
);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION archive_conversation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION unarchive_conversation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_archived_conversations() TO authenticated;

COMMENT ON FUNCTION archive_conversation(UUID) IS 'Archives a conversation for the current user only';
COMMENT ON FUNCTION unarchive_conversation(UUID) IS 'Unarchives a previously archived conversation';
COMMENT ON FUNCTION get_archived_conversations() IS 'Returns list of archived conversations for current user';
