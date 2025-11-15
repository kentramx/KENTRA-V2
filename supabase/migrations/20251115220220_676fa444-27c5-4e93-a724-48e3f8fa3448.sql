-- Hacer la columna preferences nullable para permitir suscripciones generales al newsletter
ALTER TABLE newsletter_subscriptions 
ALTER COLUMN preferences DROP NOT NULL;