-- FASE 1: Agregar campos para sistema dual venta/renta + monedas
-- Migración en pasos para evitar violaciones de constraints

-- 1. Agregar nuevas columnas SIN defaults ni constraints primero
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS for_sale BOOLEAN,
ADD COLUMN IF NOT EXISTS for_rent BOOLEAN,
ADD COLUMN IF NOT EXISTS sale_price NUMERIC,
ADD COLUMN IF NOT EXISTS rent_price NUMERIC,
ADD COLUMN IF NOT EXISTS currency TEXT;

-- 2. Migrar TODOS los datos existentes
UPDATE properties 
SET 
  for_sale = CASE WHEN listing_type = 'venta' THEN true ELSE false END,
  for_rent = CASE WHEN listing_type = 'renta' THEN true ELSE false END,
  sale_price = CASE WHEN listing_type = 'venta' THEN price ELSE NULL END,
  rent_price = CASE WHEN listing_type = 'renta' THEN price ELSE NULL END,
  currency = 'MXN'
WHERE for_sale IS NULL;

-- 3. Establecer defaults para nuevas filas
ALTER TABLE properties 
ALTER COLUMN for_sale SET DEFAULT true,
ALTER COLUMN for_rent SET DEFAULT false,
ALTER COLUMN currency SET DEFAULT 'MXN';

-- 4. Asegurar que no hay NULLs en campos booleanos
UPDATE properties SET for_sale = true WHERE for_sale IS NULL;
UPDATE properties SET for_rent = false WHERE for_rent IS NULL;
UPDATE properties SET currency = 'MXN' WHERE currency IS NULL;

-- 5. Hacer columnas NOT NULL ahora que tienen valores
ALTER TABLE properties 
ALTER COLUMN for_sale SET NOT NULL,
ALTER COLUMN for_rent SET NOT NULL,
ALTER COLUMN currency SET NOT NULL;

-- 6. Agregar constraint: al menos una opción debe estar activa
ALTER TABLE properties 
DROP CONSTRAINT IF EXISTS check_listing_options;

ALTER TABLE properties 
ADD CONSTRAINT check_listing_options CHECK (for_sale = true OR for_rent = true);

-- 7. Agregar constraints para validar precios según opciones activas
ALTER TABLE properties 
DROP CONSTRAINT IF EXISTS check_sale_price;

ALTER TABLE properties 
ADD CONSTRAINT check_sale_price CHECK (
  NOT for_sale OR (sale_price IS NOT NULL AND sale_price > 0)
);

ALTER TABLE properties 
DROP CONSTRAINT IF EXISTS check_rent_price;

ALTER TABLE properties 
ADD CONSTRAINT check_rent_price CHECK (
  NOT for_rent OR (rent_price IS NOT NULL AND rent_price > 0)
);

-- 8. Validar moneda
ALTER TABLE properties 
DROP CONSTRAINT IF EXISTS check_currency;

ALTER TABLE properties 
ADD CONSTRAINT check_currency CHECK (currency IN ('MXN', 'USD'));

-- 9. Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_properties_for_sale ON properties(for_sale) WHERE for_sale = true;
CREATE INDEX IF NOT EXISTS idx_properties_for_rent ON properties(for_rent) WHERE for_rent = true;
CREATE INDEX IF NOT EXISTS idx_properties_currency ON properties(currency);
CREATE INDEX IF NOT EXISTS idx_properties_sale_price ON properties(sale_price) WHERE sale_price IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_rent_price ON properties(rent_price) WHERE rent_price IS NOT NULL;