
ALTER TABLE public.sorteio_ganhadores ADD COLUMN IF NOT EXISTS foto_url text;
ALTER TABLE public.sorteio_ganhadores ADD COLUMN IF NOT EXISTS recusou_foto boolean DEFAULT false;

INSERT INTO storage.buckets (id, name, public)
VALUES ('sorteio-fotos', 'sorteio-fotos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view sorteio photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'sorteio-fotos');

CREATE POLICY "Authenticated users can upload sorteio photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'sorteio-fotos');

CREATE POLICY "Authenticated users can update sorteio photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'sorteio-fotos');
