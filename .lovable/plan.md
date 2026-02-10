
# Compras do Autor - Royalties Zerados

## Resumo

Adicionar um campo `is_compra_autor` na tabela `royalties_vendas` para identificar compras feitas pelo proprio autor. Essas vendas aparecem normalmente na listagem e no relatorio, porem com comissao zerada e uma indicacao visual clara do motivo.

## Alteracoes

### 1. Migracao SQL

- Adicionar coluna `is_compra_autor` (boolean, default false) na tabela `royalties_vendas`

### 2. `src/pages/royalties/Vendas.tsx`

Na tabela de vendas:
- Quando `is_compra_autor = true`, exibir a comissao como R$ 0,00
- Adicionar um Badge "Compra Autor" na coluna de Status (cor diferenciada, ex: amber/warning)
- Adicionar tooltip ou texto explicativo "Sem royalties - compra do proprio autor"

### 3. `src/components/royalties/VendaDialog.tsx`

- Adicionar checkbox "Compra do Autor" no formulario de venda manual
- Quando marcado, zerar automaticamente os campos de comissao (unitaria e total) e mostrar aviso visual
- Salvar `is_compra_autor: true` e `valor_comissao_unitario: 0, valor_comissao_total: 0`

### 4. `src/pages/royalties/Relatorios.tsx`

Na query de vendas agrupadas por livro:
- Contar vendas onde `is_compra_autor = true` no campo `compras_autor` (que hoje esta sempre em 0)
- Subtrair essas quantidades do calculo de royalties apurado
- A coluna "Compras Autor" finalmente mostrara o valor correto

### 5. `src/components/royalties/VendasSummaryCards.tsx`

- Verificar se os cards de resumo excluem vendas do autor dos totais de comissao (caso nao, ajustar)

### 6. `supabase/functions/bling-sync-royalties-sales/index.ts`

- Considerar: vendas vindas do Bling nao sao compras do autor (sao vendas normais), portanto o campo fica `false` por padrao. Nao precisa de alteracao nesta funcao.

## Detalhes tecnicos

**Coluna nova:**
```sql
ALTER TABLE royalties_vendas ADD COLUMN is_compra_autor boolean DEFAULT false;
```

**Logica no relatorio:**
Ao agrupar vendas por livro, incrementar `compras_autor` quando `venda.is_compra_autor === true`, e nao somar a comissao dessas vendas no `royalties_apurado`.

**Logica na VendaDialog:**
Quando checkbox "Compra do Autor" estiver marcado, forcar `valor_comissao_unitario = 0` e `valor_comissao_total = 0` no payload de insert, independente do calculo de percentual.
