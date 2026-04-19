-- Tabela de eventos granulares de comissão House Comunicação (3% sobre pagamentos MP)
CREATE TABLE public.comissoes_alfamarketing_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mercadopago_payment_id text NOT NULL UNIQUE,
  pedido_mp_id uuid NOT NULL REFERENCES public.ebd_shopify_pedidos_mercadopago(id) ON DELETE CASCADE,
  proposta_id uuid REFERENCES public.vendedor_propostas(id) ON DELETE SET NULL,
  valor_bruto numeric(12,2) NOT NULL,
  percentual numeric(5,2) NOT NULL DEFAULT 3,
  valor_comissao numeric(12,2) NOT NULL,
  canal text NOT NULL DEFAULT 'mercadopago_propostas',
  origem text NOT NULL DEFAULT 'mercadopago',
  status text NOT NULL DEFAULT 'a_receber',
  data_pagamento timestamptz NOT NULL,
  mes_referencia date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_comissoes_alfamkt_eventos_mes_ref 
  ON public.comissoes_alfamarketing_eventos(mes_referencia);

CREATE INDEX idx_comissoes_alfamkt_eventos_proposta 
  ON public.comissoes_alfamarketing_eventos(proposta_id);

ALTER TABLE public.comissoes_alfamarketing_eventos ENABLE ROW LEVEL SECURITY;

-- Policy: apenas admin pode visualizar (mesmo padrão de comissoes_alfamarketing)
CREATE POLICY "Admins podem ver eventos de comissão alfamarketing"
ON public.comissoes_alfamarketing_eventos
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Trigger para updated_at
CREATE TRIGGER update_comissoes_alfamkt_eventos_updated_at
BEFORE UPDATE ON public.comissoes_alfamarketing_eventos
FOR EACH ROW
EXECUTE FUNCTION public.update_ebd_onboarding_updated_at();