-- ============================================
-- KENTRA - SCRIPT DE PARCHE PARA SUPABASE
-- Ejecutar DESPUÉS del script principal
-- ============================================

-- ============================================
-- 1. STORAGE BUCKET FALTANTE: message-images
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-images', 'message-images', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas para message-images
CREATE POLICY "Users can upload message images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'message-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view message images in conversations" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'message-images' AND 
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete own message images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'message-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================
-- 2. FUNCIÓN FALTANTE: get_avg_review_time_minutes
-- ============================================
CREATE OR REPLACE FUNCTION public.get_avg_review_time_minutes()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  avg_time NUMERIC;
BEGIN
  SELECT COALESCE(
    AVG(EXTRACT(EPOCH FROM (pmh.created_at - p.created_at)) / 60),
    0
  )
  INTO avg_time
  FROM property_moderation_history pmh
  JOIN properties p ON pmh.property_id = p.id
  WHERE pmh.action IN ('approved', 'rejected')
    AND pmh.created_at >= NOW() - INTERVAL '30 days';
  
  RETURN ROUND(avg_time, 2);
END;
$$;

-- ============================================
-- 3. TABLA FALTANTE: property_views
-- (Necesaria para agent_performance_stats)
-- ============================================
CREATE TABLE IF NOT EXISTS public.property_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id UUID,
  session_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  viewed_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para property_views
CREATE INDEX IF NOT EXISTS idx_property_views_property_id ON public.property_views(property_id);
CREATE INDEX IF NOT EXISTS idx_property_views_viewed_at ON public.property_views(viewed_at);
CREATE INDEX IF NOT EXISTS idx_property_views_user_id ON public.property_views(user_id);

-- RLS para property_views
ALTER TABLE public.property_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view property views count" ON public.property_views
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert views" ON public.property_views
  FOR INSERT WITH CHECK (true);

-- ============================================
-- 4. VISTA MATERIALIZADA: agent_performance_stats
-- ============================================
DROP MATERIALIZED VIEW IF EXISTS public.agent_performance_stats;

CREATE MATERIALIZED VIEW public.agent_performance_stats AS
SELECT 
  p.agent_id,
  COUNT(DISTINCT p.id) as total_properties,
  COUNT(DISTINCT CASE WHEN p.status = 'activa' THEN p.id END) as active_properties,
  COALESCE(AVG(p.price), 0) as avg_price,
  COALESCE(AVG(ar.rating), 0) as avg_rating,
  COUNT(DISTINCT ar.id) as total_reviews,
  COUNT(DISTINCT f.id) as total_favorites,
  COUNT(DISTINCT pv.id) as total_views,
  COUNT(DISTINCT c.id) as total_conversations,
  MAX(p.created_at) as last_property_date
FROM properties p
LEFT JOIN agent_reviews ar ON ar.agent_id = p.agent_id
LEFT JOIN favorites f ON f.property_id = p.id
LEFT JOIN property_views pv ON pv.property_id = p.id
LEFT JOIN conversations c ON c.agent_id = p.agent_id
GROUP BY p.agent_id;

-- Índice único para REFRESH CONCURRENTLY
CREATE UNIQUE INDEX idx_agent_performance_stats_agent_id 
  ON public.agent_performance_stats(agent_id);

-- Función para refrescar la vista
CREATE OR REPLACE FUNCTION public.refresh_agent_performance_stats()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.agent_performance_stats;
END;
$$;

-- ============================================
-- 5. CORREGIR user_subscriptions - Columna metadata
-- ============================================
ALTER TABLE public.user_subscriptions 
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;

-- ============================================
-- 6. CORREGIR user_roles - Renombrar columnas
-- (Solo si existen con nombres incorrectos)
-- ============================================
DO $$
BEGIN
  -- Verificar si existe assigned_by y renombrar a granted_by
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_roles' 
    AND column_name = 'assigned_by'
  ) THEN
    ALTER TABLE public.user_roles RENAME COLUMN assigned_by TO granted_by;
  END IF;

  -- Verificar si existe assigned_at y renombrar a granted_at
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_roles' 
    AND column_name = 'assigned_at'
  ) THEN
    ALTER TABLE public.user_roles RENAME COLUMN assigned_at TO granted_at;
  END IF;
END $$;

-- ============================================
-- 7. AGREGAR VALORES FALTANTES A ENUMS
-- ============================================

-- property_status: agregar valores faltantes
DO $$
BEGIN
  -- Agregar 'borrador' si no existe
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'borrador' AND enumtypid = 'property_status'::regtype) THEN
    ALTER TYPE property_status ADD VALUE IF NOT EXISTS 'borrador';
  END IF;
  
  -- Agregar 'expirada' si no existe
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'expirada' AND enumtypid = 'property_status'::regtype) THEN
    ALTER TYPE property_status ADD VALUE IF NOT EXISTS 'expirada';
  END IF;
  
  -- Agregar 'rechazada' si no existe
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'rechazada' AND enumtypid = 'property_status'::regtype) THEN
    ALTER TYPE property_status ADD VALUE IF NOT EXISTS 'rechazada';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error agregando valores a property_status: %', SQLERRM;
END $$;

-- ============================================
-- 8. ÍNDICES DE RENDIMIENTO ADICIONALES
-- ============================================

-- Índices compuestos para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_properties_status_state 
  ON public.properties(status, state);

CREATE INDEX IF NOT EXISTS idx_properties_agent_status 
  ON public.properties(agent_id, status);

CREATE INDEX IF NOT EXISTS idx_properties_featured_status 
  ON public.properties(is_featured, status) 
  WHERE is_featured = true;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status 
  ON public.user_subscriptions(user_id, status);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
  ON public.messages(conversation_id, created_at DESC);

-- ============================================
-- 9. FUNCIONES HELPER ADICIONALES
-- ============================================

-- Función para obtener estadísticas de moderación
CREATE OR REPLACE FUNCTION public.get_moderation_stats()
RETURNS TABLE(
  pending_count BIGINT,
  approved_today BIGINT,
  rejected_today BIGINT,
  avg_review_minutes NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM properties WHERE status = 'pendiente')::BIGINT,
    (SELECT COUNT(*) FROM property_moderation_history 
     WHERE action = 'approved' AND created_at >= CURRENT_DATE)::BIGINT,
    (SELECT COUNT(*) FROM property_moderation_history 
     WHERE action = 'rejected' AND created_at >= CURRENT_DATE)::BIGINT,
    public.get_avg_review_time_minutes();
END;
$$;

-- Función para verificar límites de suscripción
CREATE OR REPLACE FUNCTION public.check_property_limit(p_user_id UUID)
RETURNS TABLE(
  can_create BOOLEAN,
  current_count INTEGER,
  max_allowed INTEGER,
  plan_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id UUID;
  v_max_properties INTEGER;
  v_current_count INTEGER;
  v_plan_name TEXT;
BEGIN
  -- Obtener plan activo del usuario
  SELECT us.plan_id, sp.name, (sp.features->>'max_properties')::INTEGER
  INTO v_plan_id, v_plan_name, v_max_properties
  FROM user_subscriptions us
  JOIN subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = p_user_id
    AND us.status IN ('active', 'trialing')
  ORDER BY us.created_at DESC
  LIMIT 1;

  -- Si no tiene plan, usar límites de plan gratuito
  IF v_plan_id IS NULL THEN
    v_max_properties := 1;
    v_plan_name := 'Sin plan';
  END IF;

  -- Contar propiedades activas del usuario
  SELECT COUNT(*)::INTEGER INTO v_current_count
  FROM properties
  WHERE agent_id = p_user_id
    AND status IN ('activa', 'pendiente');

  RETURN QUERY SELECT 
    v_current_count < COALESCE(v_max_properties, 999),
    v_current_count,
    COALESCE(v_max_properties, 999),
    v_plan_name;
END;
$$;

-- ============================================
-- 10. TRIGGERS FALTANTES
-- ============================================

-- Trigger para actualizar updated_at en user_subscriptions
CREATE OR REPLACE FUNCTION public.update_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON public.user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_subscription_updated_at();

-- ============================================
-- 11. VERIFICACIÓN FINAL
-- ============================================
DO $$
DECLARE
  missing_components TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Verificar bucket message-images
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'message-images') THEN
    missing_components := array_append(missing_components, 'bucket:message-images');
  END IF;

  -- Verificar función get_avg_review_time_minutes
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_avg_review_time_minutes') THEN
    missing_components := array_append(missing_components, 'function:get_avg_review_time_minutes');
  END IF;

  -- Verificar vista materializada
  IF NOT EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'agent_performance_stats') THEN
    missing_components := array_append(missing_components, 'matview:agent_performance_stats');
  END IF;

  -- Verificar tabla property_views
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'property_views') THEN
    missing_components := array_append(missing_components, 'table:property_views');
  END IF;

  -- Resultado
  IF array_length(missing_components, 1) > 0 THEN
    RAISE WARNING '⚠️ Componentes aún faltantes: %', array_to_string(missing_components, ', ');
  ELSE
    RAISE NOTICE '✅ PARCHE APLICADO CORRECTAMENTE - Todos los componentes verificados';
  END IF;
END $$;
