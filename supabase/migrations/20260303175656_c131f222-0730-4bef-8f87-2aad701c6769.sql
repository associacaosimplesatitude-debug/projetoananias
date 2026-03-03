
-- Tabela de campanhas WhatsApp
CREATE TABLE public.whatsapp_campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  status text NOT NULL DEFAULT 'rascunho',
  template_id uuid REFERENCES public.whatsapp_templates(id),
  filtros_publico jsonb,
  total_publico int NOT NULL DEFAULT 0,
  total_enviados int NOT NULL DEFAULT 0,
  total_erros int NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_campanhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gerente can manage campanhas"
  ON public.whatsapp_campanhas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente_ebd'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente_ebd'));

CREATE TRIGGER update_whatsapp_campanhas_updated_at
  BEFORE UPDATE ON public.whatsapp_campanhas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de destinatários da campanha
CREATE TABLE public.whatsapp_campanha_destinatarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL REFERENCES public.whatsapp_campanhas(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES public.ebd_clientes(id),
  telefone text,
  nome text,
  email text,
  tipo_documento text,
  status_envio text NOT NULL DEFAULT 'pendente',
  enviado_em timestamptz,
  cliques_botoes jsonb DEFAULT '{}'::jsonb,
  visitou_link boolean DEFAULT false,
  comprou boolean DEFAULT false,
  valor_compra numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_campanha_destinatarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gerente can manage destinatarios"
  ON public.whatsapp_campanha_destinatarios FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente_ebd'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente_ebd'));

CREATE INDEX idx_campanha_destinatarios_campanha ON public.whatsapp_campanha_destinatarios(campanha_id);
CREATE INDEX idx_campanha_destinatarios_status ON public.whatsapp_campanha_destinatarios(status_envio);
