-- Crear tabla para historial de asignaciones de propiedades
CREATE TABLE public.property_assignment_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  previous_agent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  new_agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  notes TEXT
);

-- Índices para mejorar performance
CREATE INDEX idx_property_assignment_history_property_id ON public.property_assignment_history(property_id);
CREATE INDEX idx_property_assignment_history_new_agent ON public.property_assignment_history(new_agent_id);

-- Habilitar RLS
ALTER TABLE public.property_assignment_history ENABLE ROW LEVEL SECURITY;

-- Política: Las inmobiliarias pueden ver el historial de propiedades de su agencia
CREATE POLICY "Agency owners can view assignment history"
ON public.property_assignment_history
FOR SELECT
TO authenticated
USING (
  property_id IN (
    SELECT p.id 
    FROM public.properties p
    JOIN public.agencies a ON p.agency_id = a.id
    WHERE a.owner_id = auth.uid()
  )
);

-- Política: Los agentes pueden ver el historial de sus propiedades
CREATE POLICY "Agents can view their property assignment history"
ON public.property_assignment_history
FOR SELECT
TO authenticated
USING (
  new_agent_id = auth.uid() OR previous_agent_id = auth.uid()
);

-- Función para registrar cambios de asignación automáticamente
CREATE OR REPLACE FUNCTION public.log_property_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo registrar si cambió el agente
  IF (TG_OP = 'UPDATE' AND OLD.agent_id IS DISTINCT FROM NEW.agent_id) THEN
    INSERT INTO public.property_assignment_history (
      property_id,
      previous_agent_id,
      new_agent_id,
      assigned_by
    ) VALUES (
      NEW.id,
      OLD.agent_id,
      NEW.agent_id,
      auth.uid()
    );
  END IF;
  
  -- Para inserts (primera asignación)
  IF (TG_OP = 'INSERT' AND NEW.agent_id IS NOT NULL) THEN
    INSERT INTO public.property_assignment_history (
      property_id,
      previous_agent_id,
      new_agent_id,
      assigned_by
    ) VALUES (
      NEW.id,
      NULL,
      NEW.agent_id,
      auth.uid()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear trigger en la tabla properties
CREATE TRIGGER property_assignment_logger
AFTER INSERT OR UPDATE ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.log_property_assignment();