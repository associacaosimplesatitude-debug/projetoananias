-- 1. Adicionar campos de nota fiscal
ALTER TABLE public.royalties_vendas 
ADD COLUMN IF NOT EXISTS nota_fiscal_numero TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS nota_fiscal_url TEXT DEFAULT NULL;

COMMENT ON COLUMN public.royalties_vendas.nota_fiscal_numero IS 'Número da NF-e';
COMMENT ON COLUMN public.royalties_vendas.nota_fiscal_url IS 'URL do DANFE/PDF da NF-e';

-- 2. Recalcular comissões zeradas baseado no percentual atual
UPDATE royalties_vendas rv
SET 
  valor_comissao_unitario = (rv.valor_unitario * rc.percentual / 100),
  valor_comissao_total = (rv.valor_unitario * rc.percentual / 100) * rv.quantidade
FROM royalties_comissoes rc
WHERE rv.livro_id = rc.livro_id
  AND rv.valor_comissao_total = 0;