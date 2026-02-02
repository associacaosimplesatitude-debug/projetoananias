
# Plano: Correção do Cálculo de Royalties

## Problema Identificado

A venda do livro "Teologia para Pentecostais" foi cadastrada com o valor errado:

| Campo | Valor Atual (Errado) | Valor Correto |
|-------|---------------------|---------------|
| `valor_unitario` | R$ 399,90 | R$ 179,96 |
| `valor_comissao_unitario` | R$ 39,99 | R$ 17,996 |
| `valor_comissao_total` | R$ 49.387,65 | R$ 22.225,06 |

**Causa raiz:** A venda foi registrada manualmente (sem Bling) usando o preço de venda ao invés do "Valor Líquido" (valor_capa) que é a base de cálculo dos royalties.

## Solução em 2 Partes

### Parte 1: Correção Imediata (SQL)
Executar uma correção no banco para recalcular as comissões de todas as vendas pendentes baseando-se no `valor_capa` atual do livro:

```sql
UPDATE royalties_vendas rv
SET 
  valor_unitario = rl.valor_capa,
  valor_comissao_unitario = ROUND((rl.valor_capa * (rc.percentual / 100))::numeric, 2),
  valor_comissao_total = ROUND((rl.valor_capa * rv.quantidade * (rc.percentual / 100))::numeric, 2)
FROM royalties_livros rl
LEFT JOIN royalties_comissoes rc ON rl.id = rc.livro_id
WHERE rv.livro_id = rl.id
  AND rv.pagamento_id IS NULL;
```

### Parte 2: Funcionalidade de Recálculo (Frontend)
Adicionar um botão "Recalcular Comissões" no Dashboard/Vendas que permita ao admin recalcular comissões de vendas pendentes quando necessário.

## Alterações Necessárias

### 1. Migration SQL - Função de Recálculo
Criar uma função RPC no banco para recalcular comissões:

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
  -- Valor antes
  SELECT COALESCE(SUM(valor_comissao_total), 0) INTO v_antes
  FROM royalties_vendas WHERE pagamento_id IS NULL;
  
  -- Recalcular
  UPDATE royalties_vendas rv
  SET 
    valor_unitario = rl.valor_capa,
    valor_comissao_unitario = ROUND((rl.valor_capa * (rc.percentual / 100))::numeric, 2),
    valor_comissao_total = ROUND((rl.valor_capa * rv.quantidade * (rc.percentual / 100))::numeric, 2)
  FROM royalties_livros rl
  LEFT JOIN royalties_comissoes rc ON rl.id = rc.livro_id
  WHERE rv.livro_id = rl.id
    AND rv.pagamento_id IS NULL;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Valor depois
  SELECT COALESCE(SUM(valor_comissao_total), 0) INTO v_depois
  FROM royalties_vendas WHERE pagamento_id IS NULL;
  
  RETURN QUERY SELECT v_count, v_antes, v_depois;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Arquivo: `src/pages/royalties/Dashboard.tsx`
Adicionar botão "Recalcular Comissões" no cabeçalho com:
- Confirmação antes de executar
- Chamada à função RPC `recalcular_royalties_pendentes`
- Exibição do resultado (vendas atualizadas, valor antes/depois)
- Invalidação automática das queries do Dashboard

### 3. Arquivo: `src/pages/royalties/Vendas.tsx`
Adicionar o mesmo botão na página de vendas para consistência.

## Resultado Esperado

Após executar o recálculo:
- **Walter Brunelli:** R$ 49.387,65 → R$ 22.225,06
- **Royalties a Pagar:** R$ 51.332,94 → ~R$ 24.170,35
- Vendas futuras sincronizadas do Bling continuarão usando o valor correto (já implementado)
- Vendas manuais também usarão o valor_capa do livro

---

## Seção Técnica

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/migrations/xxx.sql` | Criar função `recalcular_royalties_pendentes()` |
| `src/pages/royalties/Dashboard.tsx` | Adicionar botão e lógica de recálculo |
| `src/pages/royalties/Vendas.tsx` | Adicionar botão de recálculo |
| `src/components/royalties/VendaDialog.tsx` | Garantir que vendas manuais usem valor_capa |

### Fluxo do Recálculo

```
[Botão Recalcular] → [Dialog Confirmação] → [RPC recalcular_royalties_pendentes] 
  → [Toast com resultado] → [Invalidar queries] → [Dashboard atualizado]
```

### Regra de Negócio Garantida

- Royalties = Valor Líquido (valor_capa) × Quantidade × Percentual
- Vendas já pagas (com pagamento_id) não são afetadas
- Apenas vendas pendentes são recalculadas
