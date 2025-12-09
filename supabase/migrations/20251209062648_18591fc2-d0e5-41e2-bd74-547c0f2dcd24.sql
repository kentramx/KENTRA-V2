-- Eliminar el cron job de geocodificación legacy que llamaba a la función eliminada
SELECT cron.unschedule('geocode-existing-properties-daily');