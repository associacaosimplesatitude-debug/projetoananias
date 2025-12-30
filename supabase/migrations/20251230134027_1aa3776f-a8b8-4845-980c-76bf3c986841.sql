-- Criar bucket para assets EBD (avatares dos alunos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ebd-assets', 
  'ebd-assets', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Policy para permitir leitura pública
CREATE POLICY "ebd_assets_public_read" 
ON storage.objects 
FOR SELECT 
TO public
USING (bucket_id = 'ebd-assets');

-- Policy para permitir upload por usuários autenticados
CREATE POLICY "ebd_assets_authenticated_insert" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'ebd-assets');

-- Policy para permitir update por usuários autenticados
CREATE POLICY "ebd_assets_authenticated_update" 
ON storage.objects 
FOR UPDATE 
TO authenticated
USING (bucket_id = 'ebd-assets');

-- Policy para permitir delete por usuários autenticados
CREATE POLICY "ebd_assets_authenticated_delete" 
ON storage.objects 
FOR DELETE 
TO authenticated
USING (bucket_id = 'ebd-assets');