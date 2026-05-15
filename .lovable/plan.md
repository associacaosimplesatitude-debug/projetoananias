## Problema

Os cards de E-commerce, Shopee e Mercado Livre aparecem com **R$ 0,00** quando filtramos "Ontem", mas em `/admin/ebd/propostas` mostra 6 pedidos E-commerce (R$ 789,95), 2 Mercado Livre e 5 Shopee no mesmo dia.

**Causa raiz:** a função `get_resumo_diario` filtra essas tabelas por `order_date`, mas as abas em `/admin/ebd/propostas` (`AdminPedidosTab.tsx`) filtram por `created_at`. Quando `order_date` é nulo, antigo, ou está em fuso diferente, o pedido não entra no resumo do dia.

Também há divergência de filtro de status: a aba "E-commerce" do painel inclui status `Faturado` por padrão (filtro "Todos os status"), enquanto o card "E-commerce" do resumo só conta `paid` — isso pode duplicar/subtrair contagens conforme a regra desejada.

## Plano

### Migration: recriar `get_resumo_diario(data_ref date)`

Alinhar 100% com a lógica de `AdminPedidosTab.tsx`:

1. **E-commerce** (`ebd_shopify_pedidos`)
   - Filtrar por `(created_at AT TIME ZONE 'America/Sao_Paulo')::date = data_ref`
   - Status: `status_pagamento = 'paid'`

2. **Faturados** (manter as duas fontes, conforme decidido antes)
   - `ebd_shopify_pedidos` com `status_pagamento = 'Faturado'` → filtrar por `created_at`
   - `vendedor_propostas` com `status IN ('FATURADO','APROVADA_FATURAMENTO','PAGO')` → manter `COALESCE(confirmado_em, updated_at)`

3. **Mercado Pago** (`ebd_shopify_pedidos_mercadopago`)
   - Manter `created_at` + `payment_status IN ('approved','PAGO','paid')`

4. **Balcão Penha** (`vendas_balcao`)
   - Manter `created_at` + `status = 'finalizada'`

5. **Shopee / Mercado Livre** (`bling_marketplace_pedidos`)
   - Trocar `order_date` por `created_at`
   - Manter `marketplace = 'SHOPEE'` / `'MERCADO_LIVRE'` e `status_pagamento IN ('paid','Pago')`

KPIs do topo (faturamento, pedidos, ticket médio, produtos) continuam somando apenas esses 6 canais.

`vendedores_top5` e `mix_produtos` também passam a usar `created_at` para `ebd_shopify_pedidos` e `bling_marketplace_pedidos`, mantendo `confirmado_em/updated_at` para `vendedor_propostas`.

### Não muda
- Frontend `ResumoDiario.tsx` (já está com os 6 cards corretos)
- Edge function de WhatsApp
- Tabelas, RLS, cron

Após a migration os números do resumo passam a bater com o painel `/admin/ebd/propostas` no mesmo dia.