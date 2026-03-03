
ALTER TABLE public.whatsapp_templates ADD COLUMN IF NOT EXISTS cabecalho_midia_url text;

-- Create whatsapp-media storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to whatsapp-media
CREATE POLICY "Authenticated users can upload whatsapp media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'whatsapp-media');

-- Public read access
CREATE POLICY "Public read access for whatsapp media"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media');

-- Authenticated users can delete their uploads
CREATE POLICY "Authenticated users can delete whatsapp media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'whatsapp-media');
