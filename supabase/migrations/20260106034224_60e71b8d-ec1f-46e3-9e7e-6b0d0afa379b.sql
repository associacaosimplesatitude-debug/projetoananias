-- Remover tabela antiga e recriar corretamente
DROP TABLE IF EXISTS public.ebd_pos_venda_ecommerce CASCADE;

-- Criar tabela pivô correta para pós-venda e-commerce
CREATE TABLE public.ebd_pos_venda_ecommerce (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID NOT NULL,
  cliente_id UUID REFERENCES public.ebd_clientes(id) ON DELETE SET NULL,
  email_cliente TEXT NOT NULL,
  vendedor_id UUID NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente | ativado | concluido
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pedido_id)
);

-- Índices para performance
CREATE INDEX idx_ebd_pos_venda_vendedor ON public.ebd_pos_venda_ecommerce(vendedor_id);
CREATE INDEX idx_ebd_pos_venda_email ON public.ebd_pos_venda_ecommerce(email_cliente);
CREATE INDEX idx_ebd_pos_venda_status ON public.ebd_pos_venda_ecommerce(status);

-- Habilitar RLS
ALTER TABLE public.ebd_pos_venda_ecommerce ENABLE ROW LEVEL SECURITY;

-- Políticas RLS

-- Admins/Gerentes podem ver tudo
CREATE POLICY "Admins podem ver todos os vínculos pós-venda"
ON public.ebd_pos_venda_ecommerce FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'gerente_ebd')
  )
);

-- Vendedores podem ver seus próprios vínculos (usando email)
CREATE POLICY "Vendedores podem ver seus próprios vínculos"
ON public.ebd_pos_venda_ecommerce FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.vendedores 
    WHERE LOWER(vendedores.email) = LOWER(auth.jwt() ->> 'email')
    AND vendedores.id = ebd_pos_venda_ecommerce.vendedor_id
  )
);

-- Admins/Gerentes podem inserir
CREATE POLICY "Admins podem inserir vínculos"
ON public.ebd_pos_venda_ecommerce FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'gerente_ebd')
  )
);

-- Admins/Gerentes podem atualizar
CREATE POLICY "Admins podem atualizar vínculos"
ON public.ebd_pos_venda_ecommerce FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'gerente_ebd')
  )
);

-- Vendedores podem atualizar seus próprios vínculos (para ativação)
CREATE POLICY "Vendedores podem atualizar seus vínculos"
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