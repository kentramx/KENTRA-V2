-- Add new property types to the enum
ALTER TYPE property_type ADD VALUE IF NOT EXISTS 'local';
ALTER TYPE property_type ADD VALUE IF NOT EXISTS 'bodega';
ALTER TYPE property_type ADD VALUE IF NOT EXISTS 'edificio';
ALTER TYPE property_type ADD VALUE IF NOT EXISTS 'rancho';