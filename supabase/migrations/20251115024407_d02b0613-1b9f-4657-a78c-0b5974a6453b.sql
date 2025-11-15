-- Create function to reactivate paused properties
CREATE OR REPLACE FUNCTION public.reactivate_property(property_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update property status from 'pausada' to 'activa'
  UPDATE properties
  SET 
    status = 'activa',
    last_renewed_at = now(),
    expires_at = now() + interval '30 days',
    updated_at = now()
  WHERE id = property_id
    AND status = 'pausada';
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property not found or not paused';
  END IF;
END;
$$;