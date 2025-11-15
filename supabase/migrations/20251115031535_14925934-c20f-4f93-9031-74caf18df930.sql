-- Crear bucket de property-images si no existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-images',
  'property-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

-- Política: Permitir lectura pública de todas las imágenes
CREATE POLICY "Imágenes de propiedades son públicas"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'property-images');

-- Política: Usuarios autenticados pueden subir imágenes
CREATE POLICY "Usuarios autenticados pueden subir imágenes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'property-images' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM properties WHERE agent_id = auth.uid()
  )
);

-- Política: Usuarios pueden actualizar sus propias imágenes
CREATE POLICY "Usuarios pueden actualizar sus imágenes"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'property-images' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM properties WHERE agent_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'property-images' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM properties WHERE agent_id = auth.uid()
  )
);

-- Política: Usuarios pueden eliminar sus propias imágenes
CREATE POLICY "Usuarios pueden eliminar sus imágenes"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'property-images' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM properties WHERE agent_id = auth.uid()
  )
);