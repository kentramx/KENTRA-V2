-- =============================================
-- FASE 4: Índices optimizados para suscripciones
-- =============================================

-- Índice para búsqueda por stripe_subscription_id (webhooks)
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_sub_id 
ON public.user_subscriptions(stripe_subscription_id) 
WHERE stripe_subscription_id IS NOT NULL;

-- Índice para búsqueda por stripe_customer_id
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer_id 
ON public.user_subscriptions(stripe_customer_id) 
WHERE stripe_customer_id IS NOT NULL;

-- Índice compuesto para queries de estado activo por usuario
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status 
ON public.user_subscriptions(user_id, status);

-- Índice para trials que expiran (cron job)
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_trialing_period_end 
ON public.user_subscriptions(current_period_end) 
WHERE status = 'trialing';

-- Índice para past_due que necesitan suspensión (cron job)
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_past_due 
ON public.user_subscriptions(updated_at) 
WHERE status = 'past_due';

-- Índice para incomplete payments (cron job)
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_incomplete 
ON public.user_subscriptions(created_at) 
WHERE status = 'incomplete';

-- Índice para suspended que pueden reactivarse
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_suspended 
ON public.user_subscriptions(user_id) 
WHERE status = 'suspended';

-- Índice para sync de suscripciones activas con Stripe
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_active_sync 
ON public.user_subscriptions(stripe_subscription_id) 
WHERE status IN ('active', 'trialing', 'past_due') AND stripe_subscription_id IS NOT NULL;

-- Índice para featured_properties activas (reset mensual)
CREATE INDEX IF NOT EXISTS idx_featured_properties_active_agent 
ON public.featured_properties(agent_id, end_date) 
WHERE status = 'active';

-- Índice para upsells activos que expiran
CREATE INDEX IF NOT EXISTS idx_user_active_upsells_expiring 
ON public.user_active_upsells(end_date) 
WHERE status = 'active';

-- Actualizar estadísticas
ANALYZE public.user_subscriptions;
ANALYZE public.featured_properties;
ANALYZE public.user_active_upsells;