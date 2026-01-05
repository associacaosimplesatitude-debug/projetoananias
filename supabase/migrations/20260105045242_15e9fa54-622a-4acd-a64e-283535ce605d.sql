-- Criar bucket para vídeos de tutoriais
INSERT INTO storage.buckets (id, name, public)
VALUES ('tutorial-videos', 'tutorial-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso para o bucket
CREATE POLICY "Admins can upload tutorial videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tutorial-videos'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can update tutorial videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tutorial-videos'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete tutorial videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'tutorial-videos'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Anyone can view tutorial videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'tutorial-videos');

-- Adicionar coluna video_path na tabela tutoriais
ALTER TABLE public.tutoriais
ADD COLUMN IF NOT EXISTS video_path TEXT;