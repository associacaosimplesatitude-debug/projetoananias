-- Tabela pivô para pós-venda e-commerce
-- Vincula pedido Shopify → cliente → vendedor de forma explícita
CREATE TABLE public.ebd_pos_venda_ecommerce (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID NOT NULL,
  cliente_id UUID REFERENCES public.ebd_clientes(id) ON DELETE CASCADE,
  vendedor_id UUID NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  ativado BOOLEAN NOT NULL DEFAULT false,
  ativado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pedido_id)
);

-- Índices para performance
CREATE INDEX idx_ebd_pos_venda_vendedor ON public.ebd_pos_venda_ecommerce(vendedor_id);
CREATE INDEX idx_ebd_pos_venda_cliente ON public.ebd_pos_venda_ecommerce(cliente_id);
CREATE INDEX idx_ebd_pos_venda_ativado ON public.ebd_pos_venda_ecommerce(ativado);

-- RLS
ALTER TABLE public.ebd_pos_venda_ecommerce ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins podem ver todos os vínculos pós-venda"
ON public.ebd_pos_venda_ecommerce FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'gerente_ebd')
  )
);

CREATE POLICY "Vendedores podem ver seus próprios vínculos"
ON public.ebd_pos_venda_ecommerce FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.vendedores 
    WHERE LOWER(vendedores.email) = LOWER(auth.jwt() ->> 'email')
    AND vendedores.id = ebd_pos_venda_ecommerce.vendedor_id
  )
);

CREATE POLICY "Admins podem inserir vínculos"
ON public.ebd_pos_venda_ecommerce FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'gerente_ebd')
  )
);

CREATE POLICY "Admins podem atualizar vínculos"
ON public.ebd_pos_venda_ecommerce FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'gerente_ebd')
  )
);

CREATE POLICY "Vendedores podem atualizar seus vínculos (ativação)"
ON public.ebd_pos_venda_ecommerce FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.vendedores 
    WHERE LOWER(vendedores.email) = LOWER(auth.jwt() ->> 'email')
    AND vendedores.id = ebd_pos_venda_ecommerce.vendedor_id
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_ebd_pos_venda_ecommerce_updated_at
BEFORE UPDATE ON public.ebd_pos_venda_ecommerce
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();