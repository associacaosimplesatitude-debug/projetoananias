-- Limpar parcelas contaminadas com NF 030289 errada
-- Apenas as atualizadas recentemente (desde 2026-01-18)
UPDATE public.vendedor_propostas_parcelas
SET link_danfe = NULL, 
    nota_fiscal_numero = NULL,
    updated_at = now()
WHERE nota_fiscal_numero = '030289'
  AND updated_at >= '2026-01-18 01:00:00+00';