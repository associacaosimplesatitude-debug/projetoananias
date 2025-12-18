-- Tabela de propostas do vendedor
CREATE TABLE public.vendedor_propostas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor_id UUID REFERENCES public.vendedores(id),
  cliente_id UUID REFERENCES public.ebd_clientes(id),
  cliente_nome TEXT NOT NULL,
  cliente_cnpj TEXT,
  cliente_endereco JSONB,
  itens JSONB NOT NULL DEFAULT '[]'::jsonb,
  valor_produtos NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_frete NUMERIC(10,2) DEFAULT 0,
  valor_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  desconto_percentual NUMERIC(5,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PROPOSTA_PENDENTE',
  token TEXT NOT NULL UNIQUE,
  confirmado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.vendedor_propostas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Vendedores podem ver suas propostas"
  ON public.vendedor_propostas
  FOR SELECT
  USING (
    vendedor_id IN (
      SELECT id FROM public.vendedores WHERE email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Vendedores podem criar propostas"
  ON public.vendedor_propostas
  FOR INSERT
  WITH CHECK (
    vendedor_id IN (
      SELECT id FROM public.vendedores WHERE email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Vendedores podem atualizar suas propostas"
  ON public.vendedor_propostas
  FOR UPDATE
  USING (
    vendedor_id IN (
      SELECT id FROM public.vendedores WHERE email = auth.jwt()->>'email'
    )
  );

-- Política para leitura pública via token (para página de proposta)
CREATE POLICY "Leitura pública via token"
  ON public.vendedor_propostas
  FOR SELECT
  USING (true);

-- Política para atualização pública (para confirmar proposta)
CREATE POLICY "Atualização pública para confirmação"
  ON public.vendedor_propostas
  FOR UPDATE
  USING (true);

-- Índices
CREATE INDEX idx_vendedor_propostas_vendedor ON public.vendedor_propostas(vendedor_id);
CREATE INDEX idx_vendedor_propostas_token ON public.vendedor_propostas(token);
CREATE INDEX idx_vendedor_propostas_status ON public.vendedor_propostas(status);

-- Trigger para updated_at
CREATE TRIGGER update_vendedor_propostas_updated_at
  BEFORE UPDATE ON public.vendedor_propostas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();