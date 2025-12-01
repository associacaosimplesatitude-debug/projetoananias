-- Criar tabela de pedidos EBD
CREATE TABLE IF NOT EXISTS public.ebd_pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  valor_produtos NUMERIC NOT NULL DEFAULT 0,
  valor_frete NUMERIC NOT NULL DEFAULT 0,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  metodo_frete TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, approved, rejected, cancelled
  mercadopago_payment_id TEXT,
  mercadopago_preference_id TEXT,
  endereco_rua TEXT NOT NULL,
  endereco_numero TEXT NOT NULL,
  endereco_complemento TEXT,
  endereco_bairro TEXT NOT NULL,
  endereco_cidade TEXT NOT NULL,
  endereco_estado TEXT NOT NULL,
  endereco_cep TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE
);

-- Criar tabela de itens do pedido
CREATE TABLE IF NOT EXISTS public.ebd_pedidos_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.ebd_pedidos(id) ON DELETE CASCADE,
  revista_id UUID NOT NULL REFERENCES public.ebd_revistas(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL,
  preco_unitario NUMERIC NOT NULL,
  preco_total NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.ebd_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebd_pedidos_itens ENABLE ROW LEVEL SECURITY;

-- Políticas para ebd_pedidos
CREATE POLICY "Admins podem gerenciar todos pedidos"
  ON public.ebd_pedidos
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Church owners podem ver seus pedidos"
  ON public.ebd_pedidos
  FOR SELECT
  TO authenticated
  USING (
    church_id IN (
      SELECT id FROM public.churches WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Church owners podem criar seus pedidos"
  ON public.ebd_pedidos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    church_id IN (
      SELECT id FROM public.churches WHERE user_id = auth.uid()
    )
  );

-- Políticas para ebd_pedidos_itens
CREATE POLICY "Admins podem gerenciar todos itens"
  ON public.ebd_pedidos_itens
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Church owners podem ver itens de seus pedidos"
  ON public.ebd_pedidos_itens
  FOR SELECT
  TO authenticated
  USING (
    pedido_id IN (
      SELECT id FROM public.ebd_pedidos WHERE church_id IN (
        SELECT id FROM public.churches WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Church owners podem criar itens de seus pedidos"
  ON public.ebd_pedidos_itens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    pedido_id IN (
      SELECT id FROM public.ebd_pedidos WHERE church_id IN (
        SELECT id FROM public.churches WHERE user_id = auth.uid()
      )
    )
  );

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_ebd_pedidos_church_id ON public.ebd_pedidos(church_id);
CREATE INDEX IF NOT EXISTS idx_ebd_pedidos_status ON public.ebd_pedidos(status);
CREATE INDEX IF NOT EXISTS idx_ebd_pedidos_mp_payment_id ON public.ebd_pedidos(mercadopago_payment_id);
CREATE INDEX IF NOT EXISTS idx_ebd_pedidos_itens_pedido_id ON public.ebd_pedidos_itens(pedido_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_ebd_pedidos_updated_at
  BEFORE UPDATE ON public.ebd_pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();