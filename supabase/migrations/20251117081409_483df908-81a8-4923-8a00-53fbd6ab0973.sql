-- Configurar cron job para limpiar tiles expirados cada hora
SELECT cron.schedule(
  'cleanup-tile-cache-hourly',
  '0 * * * *', -- Cada hora en punto
  $$
  SELECT net.http_post(
    url := 'https://jazjzwhbagwllensnkaz.supabase.co/functions/v1/cleanup-tile-cache',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);