-- Revertir todas las coordenadas aleatorias del backfill
-- Las propiedades volverán a tener lat/lng/geom NULL hasta ser geocodificadas correctamente
UPDATE properties 
SET 
  lat = NULL, 
  lng = NULL, 
  geom = NULL 
WHERE lat IS NOT NULL 
  AND lng IS NOT NULL 
  AND status = 'activa';

-- Comentario: Este reset es necesario porque las coordenadas actuales son aleatorias
-- y no corresponden a las ubicaciones reales de las propiedades.
-- El nuevo sistema de geocodificación las llenará correctamente.