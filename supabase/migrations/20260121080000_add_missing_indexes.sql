-- Migration: Add missing critical indexes for performance
-- Date: 2026-01-21
-- Purpose: Fix CRITICAL performance issues identified in enterprise audit

-- ============================================================================
-- CRITICAL: Missing index on properties.agent_id
-- Impact: Full table scans on agent dashboard queries
-- Affected queries: SELECT * FROM properties WHERE agent_id = ?
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_properties_agent_id
ON properties(agent_id);

-- Composite index for common query pattern: agent's active properties
CREATE INDEX IF NOT EXISTS idx_properties_agent_status
ON properties(agent_id, status)
WHERE status IN ('activa', 'pendiente_aprobacion', 'borrador');

-- ============================================================================
-- CRITICAL: Missing index on featured_properties.agent_id
-- Impact: Slow queries for "agent's featured properties"
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_featured_properties_agent_id
ON featured_properties(agent_id);

-- ============================================================================
-- HIGH: Missing index on payment_history for user lookups
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_payment_history_user_created
ON payment_history(user_id, created_at DESC);

-- ============================================================================
-- HIGH: Missing index on conversion_events for analytics queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_conversion_events_user_type
ON conversion_events(user_id, event_type, created_at DESC);

-- ============================================================================
-- MEDIUM: Missing index on property_views for analytics
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_property_views_property_date
ON property_views(property_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_property_views_viewer
ON property_views(viewer_id, viewed_at DESC)
WHERE viewer_id IS NOT NULL;

-- ============================================================================
-- MEDIUM: Missing index on messages for conversation lookups
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
ON messages(conversation_id, created_at DESC);

-- ============================================================================
-- Analyze tables after adding indexes for query planner
-- ============================================================================
ANALYZE properties;
ANALYZE featured_properties;
ANALYZE payment_history;
ANALYZE conversion_events;
ANALYZE property_views;
ANALYZE messages;
