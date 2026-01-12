-- Tabela de requisições de transferência de clientes
CREATE TABLE public.ebd_transfer_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.ebd_clientes(id) ON DELETE CASCADE,
  vendedor_solicitante_id UUID NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  vendedor_atual_id UUID REFERENCES public.vendedores(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  motivo_solicitacao TEXT,
  motivo_rejeicao TEXT,
  aprovado_por UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de notificações para vendedores
CREATE TABLE public.ebd_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'aviso' CHECK (tipo IN ('transferencia', 'aviso', 'sucesso', 'erro')),
  lida BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_ebd_transfer_requests_status ON public.ebd_transfer_requests(status);
CREATE INDEX idx_ebd_transfer_requests_vendedor_solicitante ON public.ebd_transfer_requests(vendedor_solicitante_id);
CREATE INDEX idx_ebd_transfer_requests_vendedor_atual ON public.ebd_transfer_requests(vendedor_atual_id);
CREATE INDEX idx_ebd_notifications_user_email ON public.ebd_notifications(user_email);
CREATE INDEX idx_ebd_notifications_lida ON public.ebd_notifications(lida);

-- Trigger para updated_at
CREATE TRIGGER update_ebd_transfer_requests_updated_at
  BEFORE UPDATE ON public.ebd_transfer_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.ebd_transfer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebd_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies para ebd_transfer_requests

-- Vendedores podem criar requisições
CREATE POLICY "Vendedores podem criar requisições"
  ON public.ebd_transfer_requests
  FOR INSERT
  WITH CHECK (
    public.is_vendedor(public.get_auth_email())
  );

-- Vendedores podem ver suas próprias requisições (solicitante ou atual)
CREATE POLICY "Vendedores podem ver suas requisições"
  ON public.ebd_transfer_requests
  FOR SELECT
  USING (
    vendedor_solicitante_id = public.get_vendedor_id_by_email(public.get_auth_email())
    OR vendedor_atual_id = public.get_vendedor_id_by_email(public.get_auth_email())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente_ebd'::public.app_role)
  );

-- Gerentes/Admin podem atualizar requisições
CREATE POLICY "Gerentes podem atualizar requisições"
  ON public.ebd_transfer_requests
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente_ebd'::public.app_role)
  );

-- RLS Policies para ebd_notifications

-- Vendedores só veem suas próprias notificações
CREATE POLICY "Vendedores veem suas notificações"
  ON public.ebd_notifications
  FOR SELECT
  USING (
    user_email = public.get_auth_email()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Vendedores podem marcar como lida
CREATE POLICY "Vendedores podem marcar como lida"
  ON public.ebd_notifications
  FOR UPDATE
  USING (user_email = public.get_auth_email())
  WITH CHECK (user_email = public.get_auth_email());

-- Sistema pode criar notificações (via service role ou função)
CREATE POLICY "Sistema pode criar notificações"
  ON public.ebd_notifications
  FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente_ebd'::public.app_role)
    OR public.is_vendedor(public.get_auth_email())
  );