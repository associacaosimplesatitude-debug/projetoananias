-- Tabela para armazenar orçamentos de frete
CREATE TABLE public.vendedor_orcamentos_frete (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id UUID NOT NULL REFERENCES vendedores(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES ebd_clientes(id) ON DELETE CASCADE,
  
  -- Dados do pedido simulado
  itens JSONB NOT NULL DEFAULT '[]',
  peso_total_kg NUMERIC NOT NULL DEFAULT 0,
  valor_produtos NUMERIC NOT NULL DEFAULT 0,
  desconto_percentual NUMERIC DEFAULT 0,
  valor_com_desconto NUMERIC NOT NULL DEFAULT 0,
  
  -- Endereços
  endereco_coleta JSONB NOT NULL,
  endereco_entrega JSONB NOT NULL,
  
  -- Orçamento da transportadora (preenchido depois)
  transportadora_nome TEXT,
  valor_frete NUMERIC,
  prazo_entrega TEXT,
  observacoes TEXT,
  
  -- Status do fluxo
  status TEXT NOT NULL DEFAULT 'aguardando_orcamento',
  
  -- Referência para proposta quando convertido
  proposta_id UUID REFERENCES vendedor_propostas(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_vendedor_orcamentos_frete_vendedor ON vendedor_orcamentos_frete(vendedor_id);
CREATE INDEX idx_vendedor_orcamentos_frete_cliente ON vendedor_orcamentos_frete(cliente_id);
CREATE INDEX idx_vendedor_orcamentos_frete_status ON vendedor_orcamentos_frete(status);

-- RLS
ALTER TABLE vendedor_orcamentos_frete ENABLE ROW LEVEL SECURITY;

-- Política: vendedor só vê seus próprios orçamentos (baseado no email)
CREATE POLICY "Vendedores podem ver seus orçamentos"
ON vendedor_orcamentos_frete FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.vendedores 
    WHERE LOWER(vendedores.email) = LOWER(auth.jwt() ->> 'email')
    AND vendedores.id = vendedor_orcamentos_frete.vendedor_id
  )
);

-- Política: vendedor pode criar orçamentos
CREATE POLICY "Vendedores podem criar orçamentos"
ON vendedor_orcamentos_frete FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.vendedores 
    WHERE LOWER(vendedores.email) = LOWER(auth.jwt() ->> 'email')
    AND vendedores.id = vendedor_orcamentos_frete.vendedor_id
  )
);

-- Política: vendedor pode atualizar seus orçamentos
CREATE POLICY "Vendedores podem atualizar seus orçamentos"
ON vendedor_orcamentos_frete FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.vendedores 
    WHERE LOWER(vendedores.email) = LOWER(auth.jwt() ->> 'email')
    AND vendedores.id = vendedor_orcamentos_frete.vendedor_id
  )
);

-- Política: vendedor pode deletar seus orçamentos
CREATE POLICY "Vendedores podem deletar seus orçamentos"
ON vendedor_orcamentos_frete FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.vendedores 
    WHERE LOWER(vendedores.email) = LOWER(auth.jwt() ->> 'email')
    AND vendedores.id = vendedor_orcamentos_frete.vendedor_id
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_vendedor_orcamentos_frete_updated_at
BEFORE UPDATE ON vendedor_orcamentos_frete
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();