## Corrigir somatório da coluna "Fechados (mês)"

Hoje todas as colunas somam `valor_total_compras` (histórico completo do cliente). Para a coluna **Fechados (mês)**, isso infla o número porque inclui compras antigas — o que importa é o valor da venda que efetivamente fechou no mês.

### Mudança
- Em `RetencaoKanban.tsx`, no cálculo de `totalCol`:
  - Se `col.key === "fechados"` → somar `valor_ultima_compra` de cada card.
  - Demais colunas → continuam somando `valor_total_compras` (sem mudança).

### Arquivo afetado
- `src/components/admin/retencao/RetencaoKanban.tsx`