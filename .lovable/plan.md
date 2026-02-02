
# Plano: Corrigir Erro no Botão "Recalcular Comissões"

## Problema Identificado

A função SQL `recalcular_royalties_pendentes()` está falhando com o erro:

```
column "updated_at" of relation "royalties_vendas" does not exist
```

A tabela `royalties_vendas` possui as seguintes colunas (sem `updated_at`):
- id, livro_id, quantidade, valor_unitario, valor_comissao_unitario, valor_comissao_total
- data_venda, pagamento_id, created_at, bling_order_id, bling_order_number
- observacao, nota_fiscal_numero, nota_fiscal_url

Há também um warning menor de DOM nesting (`<p>` dentro de `<p>`) no dialog.

## Solução

### 1. Corrigir Função SQL (Migration)
Recriar a função `recalcular_royalties_pendentes()` removendo a linha `updated_at = now()`:

```sql
CREATE OR REPLACE FUNCTION recalcular_royalties_pendentes()
RETURNS TABLE (
  vendas_atualizadas INTEGER,
  total_antes NUMERIC,
  total_depois NUMERIC
) AS $$
DECLARE
  v_antes NUMERIC;
  v_depois NUMERIC;
  v_count INTEGER;
BEGIN
  SELECT COALESCE(SUM(valor_comissao_total), 0) INTO v_antes
  FROM royalties_vendas WHERE pagamento_id IS NULL;
  
  UPDATE royalties_vendas rv
  SET 
    valor_unitario = rl.valor_capa,
    valor_comissao_unitario = ROUND((rl.valor_capa * (COALESCE(rc.percentual, 0) / 100))::numeric, 2),
    valor_comissao_total = ROUND((rl.valor_capa * rv.quantidade * (COALESCE(rc.percentual, 0) / 100))::numeric, 2)
  FROM royalties_livros rl
  LEFT JOIN royalties_comissoes rc ON rl.id = rc.livro_id
  WHERE rv.livro_id = rl.id
    AND rv.pagamento_id IS NULL;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  SELECT COALESCE(SUM(valor_comissao_total), 0) INTO v_depois
  FROM royalties_vendas WHERE pagamento_id IS NULL;
  
  RETURN QUERY SELECT v_count, v_antes, v_depois;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Corrigir DOM Nesting no Componente
Trocar os `<p>` dentro de `AlertDialogDescription` por `<span>` com `display: block` para evitar o warning de DOM nesting.

## Alterações

| Arquivo | Alteração |
|---------|-----------|
| `supabase/migrations/xxx.sql` | Recriar função SQL sem `updated_at` |
| `src/components/royalties/RecalcularComissoesButton.tsx` | Trocar `<p>` por `<span className="block">` |

## Resultado Esperado

- O botão "Recalcular Comissões" funcionará corretamente
- Walter Brunelli: R$ 49.387,65 → R$ 22.225,06
- Royalties a Pagar será atualizado automaticamente
- Sem warnings no console
