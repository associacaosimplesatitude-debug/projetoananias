-- Adicionar campo de observacao para vendas manuais
ALTER TABLE public.royalties_vendas 
ADD COLUMN IF NOT EXISTS observacao TEXT DEFAULT NULL;

COMMENT ON COLUMN public.royalties_vendas.observacao 
IS 'Observacoes sobre vendas manuais/retroativas';