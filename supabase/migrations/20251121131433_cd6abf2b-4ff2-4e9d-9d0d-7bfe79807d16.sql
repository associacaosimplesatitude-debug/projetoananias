-- Create branding_settings table
CREATE TABLE public.branding_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nav_logo_url TEXT,
  login_logo_url TEXT,
  nav_background_color TEXT DEFAULT '#1a2d40',
  accent_color TEXT DEFAULT '#c89c5a',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.branding_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read and modify branding settings
CREATE POLICY "Admins can view branding settings"
  ON public.branding_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can update branding settings"
  ON public.branding_settings
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert branding settings"
  ON public.branding_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_branding_settings_updated_at
  BEFORE UPDATE ON public.branding_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default branding settings (only one row should exist)
INSERT INTO public.branding_settings (id) 
VALUES ('00000000-0000-0000-0000-000000000001');

-- Create storage bucket for branding assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding-assets', 'branding-assets', true);

-- Allow authenticated admins to upload branding assets
CREATE POLICY "Admins can upload branding assets"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'branding-assets' AND
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can update branding assets"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'branding-assets' AND
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Everyone can view branding assets"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'branding-assets');