-- Função para recalcular royalties de vendas pendentes
-- Usa valor_capa do livro e percentual da comissão para recalcular
CREATE OR REPLACE FUNCTION public.recalcular_royalties_pendentes()
RETURNS TABLE (
  vendas_atualizadas INTEGER,
  total_antes NUMERIC,
  total_depois NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_antes NUMERIC;
  v_depois NUMERIC;
  v_count INTEGER;
BEGIN
  -- Valor antes do recálculo
  SELECT COALESCE(SUM(valor_comissao_total), 0) INTO v_antes
  FROM royalties_vendas WHERE pagamento_id IS NULL;
  
  -- Recalcular todas as vendas pendentes usando valor_capa do livro
  UPDATE royalties_vendas rv
  SET 
    valor_unitario = rl.valor_capa,
    valor_comissao_unitario = ROUND((rl.valor_capa * (COALESCE(rc.percentual, 0) / 100))::numeric, 2),
    valor_comissao_total = ROUND((rl.valor_capa * rv.quantidade * (COALESCE(rc.percentual, 0) / 100))::numeric, 2),
    updated_at = now()
  FROM royalties_livros rl
  LEFT JOIN royalties_comissoes rc ON rl.id = rc.livro_id
  WHERE rv.livro_id = rl.id
    AND rv.pagamento_id IS NULL;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Valor depois do recálculo
  SELECT COALESCE(SUM(valor_comissao_total), 0) INTO v_depois
  FROM royalties_vendas WHERE pagamento_id IS NULL;
  
  RETURN QUERY SELECT v_count, v_antes, v_depois;
END;
$$;