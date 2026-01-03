-- Adicionar campos para frete manual na tabela vendedor_propostas
ALTER TABLE public.vendedor_propostas
ADD COLUMN IF NOT EXISTS frete_tipo TEXT DEFAULT 'automatico',
ADD COLUMN IF NOT EXISTS frete_transportadora TEXT,
ADD COLUMN IF NOT EXISTS frete_observacao TEXT,
ADD COLUMN IF NOT EXISTS frete_prazo_estimado TEXT,
ADD COLUMN IF NOT EXISTS frete_definido_por UUID REFERENCES auth.users(id);

-- Comentários para documentação
COMMENT ON COLUMN public.vendedor_propostas.frete_tipo IS 'Tipo de frete: automatico ou manual';
COMMENT ON COLUMN public.vendedor_propostas.frete_transportadora IS 'Nome da transportadora (apenas para frete manual)';
COMMENT ON COLUMN public.vendedor_propostas.frete_observacao IS 'Observação interna sobre o frete manual';
COMMENT ON COLUMN public.vendedor_propostas.frete_prazo_estimado IS 'Prazo estimado de entrega (opcional)';
COMMENT ON COLUMN public.vendedor_propostas.frete_definido_por IS 'ID do usuário que definiu o frete manual';