-- Tabela de configuração para a integração Bling de Pernambuco (Norte/Nordeste)
CREATE TABLE public.bling_config_pe (
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

-- Trigger para atualizar updated_at
CREATE TRIGGER update_bling_config_pe_updated_at
  BEFORE UPDATE ON public.bling_config_pe
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS (admin only)
ALTER TABLE public.bling_config_pe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage bling_config_pe"
  ON public.bling_config_pe
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Inserir registro inicial
INSERT INTO public.bling_config_pe (id) VALUES (gen_random_uuid());