-- ============================================================================
-- MEDIUM PRIORITY DATABASE FIXES
-- Migration: 20260121080000
-- Purpose: Add CHECK constraints, fix decimal precision, add composite indexes
-- ============================================================================

-- ============================================================================
-- 1. CHECK CONSTRAINTS ON STATUS FIELDS
-- ============================================================================

-- Subscription status validation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_subscription_status'
  ) THEN
    ALTER TABLE public.user_subscriptions
    ADD CONSTRAINT valid_subscription_status
    CHECK (status IN ('active', 'canceled', 'expired', 'paused', 'trialing', 'past_due', 'incomplete', 'incomplete_expired', 'suspended'));
  END IF;
END $$;

-- Payment history status validation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_payment_status'
  ) THEN
    ALTER TABLE public.payment_history
    ADD CONSTRAINT valid_payment_status
    CHECK (status IN ('completed', 'pending', 'failed', 'refunded', 'canceled', 'processing'));
  END IF;
END $$;

-- Payment type validation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_payment_type'
  ) THEN
    ALTER TABLE public.payment_history
    ADD CONSTRAINT valid_payment_type
    CHECK (payment_type IN ('subscription', 'featured_property', 'upsell', 'refund', 'adjustment'));
  END IF;
END $$;

-- Featured properties status validation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_featured_status'
  ) THEN
    ALTER TABLE public.featured_properties
    ADD CONSTRAINT valid_featured_status
    CHECK (status IN ('active', 'expired', 'canceled', 'pending_payment'));
  END IF;
END $$;

-- Featured properties date validation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_featured_dates'
  ) THEN
    ALTER TABLE public.featured_properties
    ADD CONSTRAINT valid_featured_dates
    CHECK (end_date > start_date);
  END IF;
END $$;

-- ============================================================================
-- 2. COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
-- ============================================================================

-- Index for agent properties by status (dashboard queries)
CREATE INDEX IF NOT EXISTS idx_properties_agent_status
ON public.properties(agent_id, status)
WHERE status IN ('activa', 'pendiente_aprobacion', 'pausada');

-- Index for properties search by listing type and status
CREATE INDEX IF NOT EXISTS idx_properties_listing_status
ON public.properties(listing_type, status)
WHERE status = 'activa';

-- Index for payment history lookups
CREATE INDEX IF NOT EXISTS idx_payment_history_user_status
ON public.payment_history(user_id, status, created_at DESC);

-- Index for subscription lookup by stripe_customer_id
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer
ON public.user_subscriptions(stripe_customer_id)
WHERE stripe_customer_id IS NOT NULL;

-- Index for featured properties by agent
CREATE INDEX IF NOT EXISTS idx_featured_properties_agent
ON public.featured_properties(agent_id, status)
WHERE status = 'active';

-- Index for conversion events analytics
CREATE INDEX IF NOT EXISTS idx_conversion_events_source_date
ON public.conversion_events(event_source, created_at DESC);

-- Index for messages conversation lookup
CREATE INDEX IF NOT EXISTS idx_messages_conversation
ON public.messages(sender_id, receiver_id, created_at DESC);

-- Index for admin audit log searches
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_search
ON public.admin_audit_log(action, created_at DESC);

-- Index for notes/reason text search in audit log (using GIN for pattern matching)
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_notes_gin
ON public.admin_audit_log USING gin(to_tsvector('spanish', COALESCE(notes, '') || ' ' || COALESCE(reason, '')));

-- ============================================================================
-- 3. ADD MISSING FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Add FK on user_subscriptions.user_id if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_subscriptions_user_id_fkey'
  ) THEN
    ALTER TABLE public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add FK on payment_history.user_id if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_history_user_id_fkey'
  ) THEN
    ALTER TABLE public.payment_history
    ADD CONSTRAINT payment_history_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add FK on featured_properties.agent_id if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'featured_properties_agent_id_fkey'
  ) THEN
    ALTER TABLE public.featured_properties
    ADD CONSTRAINT featured_properties_agent_id_fkey
    FOREIGN KEY (agent_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 4. CREATE PROPERTY CHANGE AUDIT LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.property_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES auth.users(id),
  change_type TEXT NOT NULL CHECK (change_type IN ('create', 'update', 'delete', 'status_change', 'price_change')),
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[],
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.property_change_log ENABLE ROW LEVEL SECURITY;

-- Policies: only admins can view, system can insert
CREATE POLICY "Admins can view property changes"
ON public.property_change_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
);

-- Index for property change lookups
CREATE INDEX IF NOT EXISTS idx_property_change_log_property
ON public.property_change_log(property_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_property_change_log_user
ON public.property_change_log(changed_by, created_at DESC);

-- ============================================================================
-- 5. CREATE TRIGGER FOR PROPERTY CHANGE TRACKING
-- ============================================================================

CREATE OR REPLACE FUNCTION track_property_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_changed_fields TEXT[] := '{}';
  v_change_type TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_change_type := 'create';

    INSERT INTO public.property_change_log (
      property_id,
      changed_by,
      change_type,
      new_values
    ) VALUES (
      NEW.id,
      auth.uid(),
      v_change_type,
      to_jsonb(NEW)
    );

    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Determine change type
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_change_type := 'status_change';
      v_changed_fields := array_append(v_changed_fields, 'status');
    ELSIF OLD.price IS DISTINCT FROM NEW.price OR OLD.sale_price IS DISTINCT FROM NEW.sale_price OR OLD.rent_price IS DISTINCT FROM NEW.rent_price THEN
      v_change_type := 'price_change';
    ELSE
      v_change_type := 'update';
    END IF;

    -- Track which fields changed
    IF OLD.title IS DISTINCT FROM NEW.title THEN
      v_changed_fields := array_append(v_changed_fields, 'title');
    END IF;
    IF OLD.description IS DISTINCT FROM NEW.description THEN
      v_changed_fields := array_append(v_changed_fields, 'description');
    END IF;
    IF OLD.price IS DISTINCT FROM NEW.price THEN
      v_changed_fields := array_append(v_changed_fields, 'price');
    END IF;
    IF OLD.sale_price IS DISTINCT FROM NEW.sale_price THEN
      v_changed_fields := array_append(v_changed_fields, 'sale_price');
    END IF;
    IF OLD.rent_price IS DISTINCT FROM NEW.rent_price THEN
      v_changed_fields := array_append(v_changed_fields, 'rent_price');
    END IF;
    IF OLD.address IS DISTINCT FROM NEW.address THEN
      v_changed_fields := array_append(v_changed_fields, 'address');
    END IF;
    IF OLD.lat IS DISTINCT FROM NEW.lat OR OLD.lng IS DISTINCT FROM NEW.lng THEN
      v_changed_fields := array_append(v_changed_fields, 'location');
    END IF;

    -- Only log if something actually changed
    IF array_length(v_changed_fields, 1) > 0 THEN
      INSERT INTO public.property_change_log (
        property_id,
        changed_by,
        change_type,
        old_values,
        new_values,
        changed_fields
      ) VALUES (
        NEW.id,
        auth.uid(),
        v_change_type,
        jsonb_build_object(
          'status', OLD.status,
          'title', OLD.title,
          'price', OLD.price,
          'sale_price', OLD.sale_price,
          'rent_price', OLD.rent_price,
          'address', OLD.address,
          'lat', OLD.lat,
          'lng', OLD.lng
        ),
        jsonb_build_object(
          'status', NEW.status,
          'title', NEW.title,
          'price', NEW.price,
          'sale_price', NEW.sale_price,
          'rent_price', NEW.rent_price,
          'address', NEW.address,
          'lat', NEW.lat,
          'lng', NEW.lng
        ),
        v_changed_fields
      );
    END IF;

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.property_change_log (
      property_id,
      changed_by,
      change_type,
      old_values
    ) VALUES (
      OLD.id,
      auth.uid(),
      'delete',
      to_jsonb(OLD)
    );

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_track_property_changes ON public.properties;

-- Create the trigger
CREATE TRIGGER trigger_track_property_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION track_property_changes();

-- ============================================================================
-- 6. UPDATE ANALYZE STATISTICS
-- ============================================================================

ANALYZE public.properties;
ANALYZE public.user_subscriptions;
ANALYZE public.payment_history;
ANALYZE public.featured_properties;
ANALYZE public.conversion_events;

COMMENT ON TABLE public.property_change_log IS 'Audit trail for all property modifications';
COMMENT ON FUNCTION track_property_changes IS 'Trigger function to track property changes for audit';
