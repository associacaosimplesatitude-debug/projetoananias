
-- Tabela de tracking do funil pós-venda e-commerce
CREATE TABLE public.funil_posv_tracking (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid NOT NULL REFERENCES public.ebd_clientes(id) ON DELETE CASCADE,
  fase_atual integer NOT NULL DEFAULT 1,
  fase1_enviada_em timestamptz,
  fase1_link_clicado boolean NOT NULL DEFAULT false,
  fase1_link_clicado_em timestamptz,
  fase2_enviada_em timestamptz,
  fase2_link_clicado boolean NOT NULL DEFAULT false,
  fase2_link_clicado_em timestamptz,
  fase3a_enviada_em timestamptz,
  fase3b_enviada_em timestamptz,
  fase4a_enviada_em timestamptz,
  fase4b_enviada_em timestamptz,
  fase5_enviada_em timestamptz,
  ultima_mensagem_em timestamptz,
  concluido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT funil_posv_tracking_cliente_unique UNIQUE (cliente_id),
  CONSTRAINT funil_posv_fase_check CHECK (fase_atual >= 1 AND fase_atual <= 5)
);

-- Índices para queries do cron
CREATE INDEX idx_funil_posv_fase ON public.funil_posv_tracking(fase_atual) WHERE concluido = false;
CREATE INDEX idx_funil_posv_cliente ON public.funil_posv_tracking(cliente_id);

-- RLS
ALTER TABLE public.funil_posv_tracking ENABLE ROW LEVEL SECURITY;

-- Admins podem ver e editar tudo
CREATE POLICY "Admins full access funil_posv_tracking"
ON public.funil_posv_tracking
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Vendedores podem ver tracking dos seus clientes
CREATE POLICY "Vendedores can view their clients tracking"
ON public.funil_posv_tracking
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.ebd_clientes ec
    JOIN public.vendedores v ON ec.vendedor_id = v.id
    WHERE ec.id = funil_posv_tracking.cliente_id
      AND v.email = public.get_auth_email()
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_funil_posv_tracking_updated_at
BEFORE UPDATE ON public.funil_posv_tracking
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
