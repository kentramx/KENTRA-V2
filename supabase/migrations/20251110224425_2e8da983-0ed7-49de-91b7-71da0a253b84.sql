-- ====================================
-- SISTEMA DE AUTO-APROBACIÓN INTELIGENTE CON IA
-- ====================================

-- 1. Eliminar trigger anterior si existe
DROP TRIGGER IF EXISTS auto_approve_trusted_agents_trigger ON public.properties;

-- 2. Crear función de auto-aprobación que combina IA + agente confiable
CREATE OR REPLACE FUNCTION public.auto_approve_with_ai()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_trusted BOOLEAN;
  should_auto_approve BOOLEAN := false;
  approval_reason TEXT;
BEGIN
  -- Solo aplicar a propiedades nuevas en estado pendiente
  IF TG_OP = 'INSERT' AND NEW.status = 'pendiente_aprobacion' THEN
    
    -- Verificar si el agente es confiable (20+ aprobaciones sin rechazos en 3 meses)
    is_trusted := check_trusted_agent(NEW.agent_id);
    
    -- CONDICIÓN 1: Agente confiable + Score IA excelente (≥95)
    IF is_trusted 
       AND NEW.ai_moderation_score IS NOT NULL 
       AND NEW.ai_moderation_score >= 95 
       AND NEW.ai_moderation_status = 'pass' THEN
      
      should_auto_approve := true;
      approval_reason := 'Auto-aprobado: Agente Confiable + IA Score Excelente (' || NEW.ai_moderation_score || '/100)';
      
    -- CONDICIÓN 2: Agente confiable sin análisis de IA (fallback legacy)
    ELSIF is_trusted AND NEW.ai_moderation_score IS NULL THEN
      
      should_auto_approve := true;
      approval_reason := 'Auto-aprobado: Agente Confiable (sin análisis IA)';
      
    END IF;
    
    -- Ejecutar auto-aprobación si cumple condiciones
    IF should_auto_approve THEN
      
      -- Actualizar status a activa
      NEW.status := 'activa';
      NEW.last_renewed_at := NOW();
      NEW.expires_at := NOW() + INTERVAL '30 days';
      
      -- Registrar en historial de moderación
      INSERT INTO public.property_moderation_history (
        property_id,
        agent_id,
        admin_id,
        action,
        notes
      ) VALUES (
        NEW.id,
        NEW.agent_id,
        NULL, -- NULL = auto-aprobado por sistema
        'auto_approved',
        approval_reason
      );
      
      RAISE NOTICE 'Propiedad % auto-aprobada: %', NEW.id, approval_reason;
      
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Crear trigger
CREATE TRIGGER auto_approve_with_ai_trigger
BEFORE INSERT ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.auto_approve_with_ai();

-- 4. Función para obtener estadísticas de auto-aprobación
CREATE OR REPLACE FUNCTION public.get_auto_approval_stats()
RETURNS TABLE (
  total_auto_approved BIGINT,
  auto_approved_by_ai BIGINT,
  auto_approved_legacy BIGINT,
  avg_ai_score_auto_approved NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COUNT(*) FILTER (WHERE action = 'auto_approved') as total_auto_approved,
    COUNT(*) FILTER (WHERE action = 'auto_approved' AND notes LIKE '%IA Score%') as auto_approved_by_ai,
    COUNT(*) FILTER (WHERE action = 'auto_approved' AND notes NOT LIKE '%IA Score%') as auto_approved_legacy,
    AVG(p.ai_moderation_score) FILTER (WHERE pmh.action = 'auto_approved' AND p.ai_moderation_score IS NOT NULL) as avg_ai_score_auto_approved
  FROM public.property_moderation_history pmh
  LEFT JOIN public.properties p ON p.id = pmh.property_id
  WHERE pmh.created_at >= NOW() - INTERVAL '30 days';
$$;

-- 5. Comentarios
COMMENT ON FUNCTION public.auto_approve_with_ai() IS 'Auto-aprueba propiedades de agentes confiables con score IA ≥95/100';
COMMENT ON FUNCTION public.get_auto_approval_stats() IS 'Estadísticas de auto-aprobaciones últimos 30 días';