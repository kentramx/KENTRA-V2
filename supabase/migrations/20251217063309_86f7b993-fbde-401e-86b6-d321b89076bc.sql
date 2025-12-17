-- Índice para búsquedas rápidas por stripe_subscription_id (crítico para webhooks)
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_subscription_id 
ON public.user_subscriptions (stripe_subscription_id) 
WHERE stripe_subscription_id IS NOT NULL;

-- Índice para búsquedas de suscripciones incomplete (para cron job de expiración)
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_incomplete_created 
ON public.user_subscriptions (created_at) 
WHERE status = 'incomplete';