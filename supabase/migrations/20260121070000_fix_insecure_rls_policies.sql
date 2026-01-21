-- ============================================================================
-- FIX INSECURE RLS INSERT POLICIES
-- Date: 2026-01-21
-- Description: Corrige políticas INSERT que permiten inserciones sin autenticación
-- Las políticas "WITH CHECK (true)" permiten a CUALQUIER usuario (incluyendo anónimos)
-- insertar datos, lo cual es una vulnerabilidad crítica de seguridad.
-- ============================================================================

-- ============================================================================
-- 1. property_views - Requiere autenticación para tracking de vistas
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can insert views" ON public.property_views;

-- Nuevas políticas: permitir vistas solo de usuarios autenticados
CREATE POLICY "Authenticated users can insert views"
ON public.property_views
FOR INSERT
TO authenticated
WITH CHECK (
  -- El viewer_id debe ser null o el usuario actual
  viewer_id IS NULL OR viewer_id = auth.uid()
);

-- ============================================================================
-- 2. trial_tracking - Solo service_role puede insertar (desde Edge Functions)
-- ============================================================================
DROP POLICY IF EXISTS "Sistema puede insertar trial tracking" ON public.trial_tracking;

CREATE POLICY "Service role can insert trial tracking"
ON public.trial_tracking
FOR INSERT
WITH CHECK (
  -- Solo service_role puede insertar (desde Edge Functions/cron jobs)
  (SELECT auth.role()) = 'service_role'
);

-- ============================================================================
-- 3. conversion_events - Solo service_role puede insertar
-- ============================================================================
DROP POLICY IF EXISTS "Sistema puede insertar eventos de conversión" ON public.conversion_events;

CREATE POLICY "Service role can insert conversion events"
ON public.conversion_events
FOR INSERT
WITH CHECK (
  (SELECT auth.role()) = 'service_role'
);

-- ============================================================================
-- 4. user_active_upsells - Solo service_role puede insertar (pagos)
-- ============================================================================
DROP POLICY IF EXISTS "System can insert upsells" ON public.user_active_upsells;

CREATE POLICY "Service role can insert upsells"
ON public.user_active_upsells
FOR INSERT
WITH CHECK (
  (SELECT auth.role()) = 'service_role'
);

-- También corregir la política de UPDATE
DROP POLICY IF EXISTS "System can update upsells" ON public.user_active_upsells;

CREATE POLICY "Service role can update upsells"
ON public.user_active_upsells
FOR UPDATE
USING ((SELECT auth.role()) = 'service_role');

-- ============================================================================
-- 5. kyc_verification_history - Solo service_role (se inserta via trigger)
-- ============================================================================
DROP POLICY IF EXISTS "Sistema puede insertar historial de KYC" ON public.kyc_verification_history;

CREATE POLICY "Service role can insert kyc history"
ON public.kyc_verification_history
FOR INSERT
WITH CHECK (
  (SELECT auth.role()) = 'service_role'
);

-- ============================================================================
-- 6. property_moderation_history - Solo service_role (acciones admin)
-- ============================================================================
DROP POLICY IF EXISTS "Solo sistema puede insertar registros" ON public.property_moderation_history;

CREATE POLICY "Service role can insert moderation history"
ON public.property_moderation_history
FOR INSERT
WITH CHECK (
  (SELECT auth.role()) = 'service_role'
);

-- ============================================================================
-- 7. conversation_participants - Solo service_role (se inserta via trigger)
-- ============================================================================
DROP POLICY IF EXISTS "System can insert participant records" ON public.conversation_participants;

CREATE POLICY "Service role can insert participants"
ON public.conversation_participants
FOR INSERT
WITH CHECK (
  (SELECT auth.role()) = 'service_role'
);

-- ============================================================================
-- 8. property_expiry_reminders - Solo service_role (cron job)
-- ============================================================================
DROP POLICY IF EXISTS "Service role can insert expiry reminders" ON public.property_expiry_reminders;

CREATE POLICY "Only service role can insert expiry reminders"
ON public.property_expiry_reminders
FOR INSERT
WITH CHECK (
  (SELECT auth.role()) = 'service_role'
);

-- ============================================================================
-- 9. image_ai_analysis - Solo service_role (análisis AI backend)
-- ============================================================================
DROP POLICY IF EXISTS "Sistema puede insertar análisis" ON public.image_ai_analysis;

CREATE POLICY "Service role can insert image analysis"
ON public.image_ai_analysis
FOR INSERT
WITH CHECK (
  (SELECT auth.role()) = 'service_role'
);

-- ============================================================================
-- NOTA IMPORTANTE:
-- Las funciones TRIGGER se ejecutan con SECURITY DEFINER y tienen acceso
-- a service_role implícitamente, por lo que los triggers seguirán funcionando.
-- Las Edge Functions que usan SUPABASE_SERVICE_ROLE_KEY también funcionarán.
-- ============================================================================

-- ============================================================================
-- VERIFICACIÓN: Listar todas las políticas de INSERT para auditoría
-- ============================================================================
-- Para verificar que las políticas están correctas, ejecutar:
-- SELECT schemaname, tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE cmd = 'INSERT'
-- ORDER BY tablename;
