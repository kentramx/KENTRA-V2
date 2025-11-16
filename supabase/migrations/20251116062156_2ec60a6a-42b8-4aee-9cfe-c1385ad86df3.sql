-- Agregar sistema de códigos únicos para propiedades (formato KEN-000001)

-- 1. Agregar columna property_code
ALTER TABLE properties 
ADD COLUMN property_code TEXT UNIQUE;

-- 2. Crear índice para búsqueda rápida
CREATE INDEX idx_properties_property_code ON properties(property_code);

-- 3. Crear secuencia para generar códigos
CREATE SEQUENCE property_code_seq START 1;

-- 4. Función para generar códigos con formato KEN-000001
CREATE OR REPLACE FUNCTION generate_property_code()
RETURNS TEXT AS $$
DECLARE
  next_id INTEGER;
BEGIN
  next_id := nextval('property_code_seq');
  RETURN 'KEN-' || LPAD(next_id::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger para auto-generar código al crear propiedades nuevas
CREATE OR REPLACE FUNCTION set_property_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.property_code IS NULL THEN
    NEW.property_code := generate_property_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_property_code
  BEFORE INSERT ON properties
  FOR EACH ROW
  EXECUTE FUNCTION set_property_code();

-- 6. Generar códigos para todas las propiedades existentes
UPDATE properties 
SET property_code = generate_property_code()
WHERE property_code IS NULL;