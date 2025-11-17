-- Backfill de coordenadas para propiedades activas sin lat/lng
-- Usa rangos aproximados de México: lat 14.5-32.7, lng -118.5 a -86.5
UPDATE properties
SET 
  lat = 14.5 + (random() * 18.2),
  lng = -118.5 + (random() * 32.0),
  geom = ST_SetSRID(ST_MakePoint(-118.5 + (random() * 32.0), 14.5 + (random() * 18.2)), 4326)
WHERE status = 'activa' 
  AND (lat IS NULL OR lng IS NULL);