INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-assets', 'campaign-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for campaign assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'campaign-assets');

CREATE POLICY "Admin upload campaign assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'campaign-assets');