-- Tabela para armazenar configurações da integração Bling
CREATE TABLE public.bling_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id text,
  client_secret text,
  redirect_uri text,
  access_token text,
  refresh_token text,
  loja_id integer DEFAULT 205797806,
  token_expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bling_config ENABLE ROW LEVEL SECURITY;

-- Only admins can manage bling config
CREATE POLICY "Admins can manage bling config" 
ON public.bling_config 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_bling_config_updated_at
BEFORE UPDATE ON public.bling_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default row
INSERT INTO public.bling_config (loja_id) VALUES (205797806);