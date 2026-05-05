## Mostrar valor total + valor da última compra no card

No Kanban da Retenção, manter o valor total acumulado e adicionar abaixo o valor da última compra (a mais recente entre Shopify, Mercado Pago e Faturado).

### Alterações

**1. RPC `get_retencao_dashboard` (migration)**
- No CTE `base`, adicionar `valor_ultima_compra`: o `valor_total` do pedido cuja data corresponde a `data_ultima_compra` (vem da CTE de canal vencedor — Shopify, MP ou Faturado).
- Implementação: nas CTEs `ult_shopify`, `ult_mp`, `ult_fat`, capturar também `val_ultimo` = `(array_agg(valor_total ORDER BY created_at DESC))[1]`. Em `base`, escolher o `val_ultimo` do canal cuja `dt` é a maior (mesmo critério já usado para `canal_ultima_compra`).
- Adicionar `valor_ultima_compra` (numeric, 2 casas) ao JSON `kanban_clientes`.

**2. `RetencaoKanban.tsx`**
- Adicionar `valor_ultima_compra?: number` à interface `KanbanCliente`.
- No card, manter a linha "Compra: R$ X" mostrando `valor_total_compras` (renomear para "Total compras: R$ X" para clareza).
- Adicionar nova linha logo abaixo: "Última: R$ Y" com `valor_ultima_compra`.

### Fora de escopo
- Faixas, totais por coluna, lógica de classificação, modais.
