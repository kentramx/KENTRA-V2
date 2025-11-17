-- Crear cron job para geocodificar propiedades existentes sin coordenadas
-- Se ejecuta diariamente a las 4:00 AM procesando 50 propiedades por ejecución

SELECT cron.schedule(
  'geocode-existing-properties-daily',
  '0 4 * * *', -- Todos los días a las 4 AM
  $$
  SELECT net.http_post(
    url := 'https://jazjzwhbagwllensnkaz.supabase.co/functions/v1/geocode-existing-properties',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);