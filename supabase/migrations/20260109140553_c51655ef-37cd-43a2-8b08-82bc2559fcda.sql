-- Create table for Bling Penha configuration
CREATE TABLE public.bling_config_penha (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT,
  client_secret TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  loja_id BIGINT,
  redirect_uri TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bling_config_penha ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to read/write
CREATE POLICY "Allow authenticated users to manage bling_config_penha"
ON public.bling_config_penha
FOR ALL
USING (true)
WITH CHECK (true);