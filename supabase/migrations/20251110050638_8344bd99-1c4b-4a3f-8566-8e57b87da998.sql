-- Agregar política RLS para que inmobiliarias puedan actualizar propiedades de su agencia
CREATE POLICY "Agency owners can update agency properties"
ON public.properties
FOR UPDATE
TO authenticated
USING (
  agency_id IN (
    SELECT id FROM public.agencies WHERE owner_id = auth.uid()
  )
);