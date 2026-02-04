-- Tabela de templates de email para royalties
CREATE TABLE public.royalties_email_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  assunto TEXT NOT NULL,
  corpo_html TEXT NOT NULL,
  variaveis JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de logs de envio de email
CREATE TABLE public.royalties_email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES public.royalties_email_templates(id),
  autor_id UUID REFERENCES public.royalties_autores(id),
  destinatario TEXT NOT NULL,
  assunto TEXT NOT NULL,
  status TEXT DEFAULT 'enviado',
  erro TEXT,
  dados_enviados JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.royalties_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.royalties_email_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies para templates (apenas admins/gerente_royalties)
CREATE POLICY "Admins podem ver templates" ON public.royalties_email_templates
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'gerente_royalties'))
  );

CREATE POLICY "Admins podem inserir templates" ON public.royalties_email_templates
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'gerente_royalties'))
  );

CREATE POLICY "Admins podem atualizar templates" ON public.royalties_email_templates
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'gerente_royalties'))
  );

CREATE POLICY "Admins podem deletar templates" ON public.royalties_email_templates
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'gerente_royalties'))
  );

-- RLS Policies para logs (apenas admins podem ver)
CREATE POLICY "Admins podem ver logs" ON public.royalties_email_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'gerente_royalties'))
  );

CREATE POLICY "Admins podem inserir logs" ON public.royalties_email_logs
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'gerente_royalties'))
  );

-- Trigger para updated_at
CREATE TRIGGER update_royalties_email_templates_updated_at
  BEFORE UPDATE ON public.royalties_email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();