
-- Actualizar política de creación de reviews en agent_reviews
-- Solo permitir reviews de compradores que han contactado al agente

DROP POLICY IF EXISTS "Buyers can create reviews" ON agent_reviews;

CREATE POLICY "Buyers can create reviews if they contacted the agent"
ON agent_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = buyer_id 
  AND EXISTS (
    SELECT 1 
    FROM conversations 
    WHERE (conversations.buyer_id = auth.uid() AND conversations.agent_id = agent_reviews.agent_id)
       OR (conversations.agent_id = auth.uid() AND conversations.buyer_id = agent_reviews.agent_id)
  )
);

-- Agregar índice para optimizar la validación de conversaciones
CREATE INDEX IF NOT EXISTS idx_conversations_buyer_agent 
ON conversations(buyer_id, agent_id);

CREATE INDEX IF NOT EXISTS idx_conversations_agent_buyer 
ON conversations(agent_id, buyer_id);
