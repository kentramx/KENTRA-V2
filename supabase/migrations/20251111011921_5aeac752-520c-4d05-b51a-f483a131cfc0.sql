-- Make property_id nullable to support direct agent conversations
ALTER TABLE public.conversations 
ALTER COLUMN property_id DROP NOT NULL;

-- Add index for direct conversations (where property_id is null)
CREATE INDEX idx_conversations_direct 
ON public.conversations (buyer_id, agent_id) 
WHERE property_id IS NULL;

-- Add comment explaining the change
COMMENT ON COLUMN public.conversations.property_id IS 
'Property ID for property-specific conversations. NULL for direct agent conversations.';