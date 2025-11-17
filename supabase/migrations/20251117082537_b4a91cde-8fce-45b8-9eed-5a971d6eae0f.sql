-- Agregar constraint único que falta en property_tiles_cache
ALTER TABLE property_tiles_cache
ADD CONSTRAINT property_tiles_cache_tile_key_filters_hash_key 
UNIQUE (tile_key, filters_hash);