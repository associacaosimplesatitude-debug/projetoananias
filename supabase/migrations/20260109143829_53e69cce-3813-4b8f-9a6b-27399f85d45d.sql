-- Criar tabela para vendas de balcão (PDV)
CREATE TABLE public.vendas_balcao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor_id UUID REFERENCES public.vendedores(id) NOT NULL,
  polo TEXT NOT NULL DEFAULT 'penha',
  cliente_nome TEXT NOT NULL,
  cliente_cpf TEXT,
  cliente_telefone TEXT,
  itens JSONB NOT NULL DEFAULT '[]'::jsonb,
  valor_subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_desconto NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  forma_pagamento TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'concluida',
  bling_order_id BIGINT,
  bling_synced_at TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_vendas_balcao_vendedor ON public.vendas_balcao(vendedor_id);
CREATE INDEX idx_vendas_balcao_created ON public.vendas_balcao(created_at DESC);
CREATE INDEX idx_vendas_balcao_polo ON public.vendas_balcao(polo);

-- Enable RLS
ALTER TABLE public.vendas_balcao ENABLE ROW LEVEL SECURITY;

-- Política: Vendedores podem ver suas próprias vendas
CREATE POLICY "Vendedores podem ver suas vendas"
ON public.vendas_balcao
FOR SELECT
USING (
  vendedor_id = (SELECT id FROM public.vendedores WHERE email = public.get_auth_email())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gerente_ebd'::public.app_role)
);

-- Política: Vendedores podem criar vendas
CREATE POLICY "Vendedores podem criar vendas"
ON public.vendas_balcao
FOR INSERT
WITH CHECK (
  vendedor_id = (SELECT id FROM public.vendedores WHERE email = public.get_auth_email())
);

-- Política: Admins podem atualizar vendas
CREATE POLICY "Admins podem atualizar vendas"
ON public.vendas_balcao
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gerente_ebd'::public.app_role)
);

-- Trigger para updated_at
CREATE TRIGGER update_vendas_balcao_updated_at
BEFORE UPDATE ON public.vendas_balcao
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();