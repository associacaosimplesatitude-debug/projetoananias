-- Adicionar novos campos à tabela vendedor_propostas_parcelas para controle de comissões
ALTER TABLE vendedor_propostas_parcelas 
ADD COLUMN IF NOT EXISTS comissao_status TEXT DEFAULT 'pendente',
ADD COLUMN IF NOT EXISTS data_liberacao DATE,
ADD COLUMN IF NOT EXISTS comissao_paga_em TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS lote_pagamento_id UUID;

-- Comentários para documentação
COMMENT ON COLUMN vendedor_propostas_parcelas.comissao_status IS 'Status da comissão: pendente, agendada, liberada, paga, atrasada';
COMMENT ON COLUMN vendedor_propostas_parcelas.data_liberacao IS 'Data em que a comissão foi liberada para pagamento';
COMMENT ON COLUMN vendedor_propostas_parcelas.comissao_paga_em IS 'Data/hora em que o financeiro marcou como paga';
COMMENT ON COLUMN vendedor_propostas_parcelas.lote_pagamento_id IS 'Referência ao lote de pagamento';

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_parcelas_comissao_status ON vendedor_propostas_parcelas(comissao_status);
CREATE INDEX IF NOT EXISTS idx_parcelas_lote_pagamento ON vendedor_propostas_parcelas(lote_pagamento_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_data_liberacao ON vendedor_propostas_parcelas(data_liberacao);

-- Criar tabela de lotes de pagamento
CREATE TABLE IF NOT EXISTS comissao_lotes_pagamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referencia TEXT NOT NULL,
  mes_referencia DATE NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'dia_05',
  valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantidade_itens INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'aberto',
  responsavel_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  fechado_em TIMESTAMP WITH TIME ZONE,
  pago_em TIMESTAMP WITH TIME ZONE
);

-- RLS para lotes (usando apenas roles que existem: admin e gerente_ebd)
ALTER TABLE comissao_lotes_pagamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver lotes" ON comissao_lotes_pagamento
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    public.has_role(auth.uid(), 'gerente_ebd'::public.app_role)
  );

CREATE POLICY "Admins podem inserir lotes" ON comissao_lotes_pagamento
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    public.has_role(auth.uid(), 'gerente_ebd'::public.app_role)
  );

CREATE POLICY "Admins podem atualizar lotes" ON comissao_lotes_pagamento
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    public.has_role(auth.uid(), 'gerente_ebd'::public.app_role)
  );

-- Adicionar FK para lote_pagamento_id
ALTER TABLE vendedor_propostas_parcelas
ADD CONSTRAINT fk_parcelas_lote_pagamento
FOREIGN KEY (lote_pagamento_id) REFERENCES comissao_lotes_pagamento(id)
ON DELETE SET NULL;