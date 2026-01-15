-- Tabela para pedidos de produtos Shopify pagos via Mercado Pago
-- Isso evita a comissão da Shopify e vincula o vendedor ao pedido

CREATE TABLE public.ebd_shopify_pedidos_mercadopago (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Vínculo com vendedor (RESOLVENDO O PROBLEMA DO EMAIL!)
  vendedor_id UUID REFERENCES vendedores(id),
  vendedor_email TEXT,
  vendedor_nome TEXT,
  
  -- Cliente
  cliente_id UUID REFERENCES ebd_clientes(id),
  cliente_nome TEXT,
  cliente_cpf_cnpj TEXT,
  cliente_email TEXT,
  cliente_telefone TEXT,
  
  -- Pagamento Mercado Pago
  mercadopago_payment_id TEXT,
  mercadopago_preference_id TEXT,
  payment_method TEXT, -- 'pix', 'credit_card', 'boleto'
  payment_status TEXT DEFAULT 'pending',
  status TEXT DEFAULT 'AGUARDANDO_PAGAMENTO',
  
  -- Valores
  valor_produtos NUMERIC(10,2) NOT NULL,
  valor_frete NUMERIC(10,2) DEFAULT 0,
  valor_desconto NUMERIC(10,2) DEFAULT 0,
  valor_total NUMERIC(10,2) NOT NULL,
  
  -- Frete
  metodo_frete TEXT,
  prazo_entrega_dias INTEGER,
  endereco_cep TEXT,
  endereco_rua TEXT,
  endereco_numero TEXT,
  endereco_complemento TEXT,
  endereco_bairro TEXT,
  endereco_cidade TEXT,
  endereco_estado TEXT,
  
  -- Itens (JSON com produtos Shopify)
  items JSONB NOT NULL,
  
  -- Bling integration
  bling_order_id BIGINT,
  bling_created_at TIMESTAMPTZ,
  
  -- Observações
  observacoes TEXT
);

-- Enable RLS
ALTER TABLE public.ebd_shopify_pedidos_mercadopago ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Vendedores podem ver seus próprios pedidos"
ON public.ebd_shopify_pedidos_mercadopago
FOR SELECT
USING (
  vendedor_id IN (
    SELECT id FROM vendedores WHERE email = auth.jwt() ->> 'email'
  )
);

CREATE POLICY "Vendedores podem criar pedidos"
ON public.ebd_shopify_pedidos_mercadopago
FOR INSERT
WITH CHECK (
  vendedor_id IN (
    SELECT id FROM vendedores WHERE email = auth.jwt() ->> 'email'
  )
);

CREATE POLICY "Admins podem ver todos os pedidos"
ON public.ebd_shopify_pedidos_mercadopago
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Service role pode fazer tudo"
ON public.ebd_shopify_pedidos_mercadopago
FOR ALL
USING (auth.role() = 'service_role');

-- Índices para performance
CREATE INDEX idx_ebd_shopify_mp_vendedor ON public.ebd_shopify_pedidos_mercadopago(vendedor_id);
CREATE INDEX idx_ebd_shopify_mp_cliente ON public.ebd_shopify_pedidos_mercadopago(cliente_id);
CREATE INDEX idx_ebd_shopify_mp_status ON public.ebd_shopify_pedidos_mercadopago(status);
CREATE INDEX idx_ebd_shopify_mp_payment_id ON public.ebd_shopify_pedidos_mercadopago(mercadopago_payment_id);

-- Trigger para updated_at
CREATE TRIGGER update_ebd_shopify_pedidos_mercadopago_updated_at
BEFORE UPDATE ON public.ebd_shopify_pedidos_mercadopago
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();