
-- Table for system settings (Z-API credentials, etc.)
CREATE TABLE public.system_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL DEFAULT '',
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read system_settings"
  ON public.system_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'gerente_ebd')
    )
  );

CREATE POLICY "Admins can insert system_settings"
  ON public.system_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'gerente_ebd')
    )
  );

CREATE POLICY "Admins can update system_settings"
  ON public.system_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'gerente_ebd')
    )
  );

-- Table for WhatsApp message history
CREATE TABLE public.whatsapp_mensagens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_mensagem TEXT NOT NULL,
  telefone_destino TEXT NOT NULL,
  nome_destino TEXT,
  mensagem TEXT NOT NULL,
  imagem_url TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  erro_detalhes TEXT,
  enviado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read whatsapp_mensagens"
  ON public.whatsapp_mensagens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'gerente_ebd')
    )
  );

CREATE POLICY "Admins can insert whatsapp_mensagens"
  ON public.whatsapp_mensagens FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'gerente_ebd')
    )
  );

-- Trigger for updated_at on system_settings
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
