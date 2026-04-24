-- Garantir função de updated_at (reutiliza se já existir)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.ebd_loja_pedidos_cg (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_order_id uuid NOT NULL UNIQUE,
  loja_order_number integer NOT NULL,
  status_pagamento text NOT NULL DEFAULT 'pending',
  status_pedido text NOT NULL DEFAULT 'pending',
  payment_method text,
  customer_email text,
  customer_name text,
  customer_phone text,
  customer_document text,
  valor_total numeric NOT NULL DEFAULT 0,
  valor_subtotal numeric NOT NULL DEFAULT 0,
  valor_frete numeric NOT NULL DEFAULT 0,
  valor_desconto numeric NOT NULL DEFAULT 0,
  codigo_rastreio text,
  url_rastreio text,
  endereco_rua text,
  endereco_numero text,
  endereco_complemento text,
  endereco_bairro text,
  endereco_cidade text,
  endereco_estado text,
  endereco_cep text,
  endereco_nome text,
  endereco_telefone text,
  stripe_payment_id text,
  mp_payment_id text,
  order_date timestamptz,
  paid_at timestamptz,
  vendedor_id uuid,
  cliente_id uuid,
  comissao_aprovada boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ebd_loja_pedidos_cg_status_pagamento ON public.ebd_loja_pedidos_cg(status_pagamento);
CREATE INDEX idx_ebd_loja_pedidos_cg_created_at ON public.ebd_loja_pedidos_cg(created_at DESC);

ALTER TABLE public.ebd_loja_pedidos_cg ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view loja pedidos cg"
  ON public.ebd_loja_pedidos_cg
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_ebd_loja_pedidos_cg_updated_at
  BEFORE UPDATE ON public.ebd_loja_pedidos_cg
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();