-- Crear bucket público para imágenes OG
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('og-images', 'og-images', true, 5242880)
ON CONFLICT (id) DO NOTHING;

-- Política para lectura pública
CREATE POLICY "Public read access for og-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'og-images');

-- Política para escritura desde service role
CREATE POLICY "Service role can upload og-images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'og-images');