# Resumo Diário — 6 canais oficiais

## Objetivo

Em `/admin/resumo-diario`, exibir em "Vendas por canal" apenas estes 6 cards, e fazer os KPIs do topo somarem somente eles:

1. **Faturados** — duas fontes mantidas:
   - `ebd_shopify_pedidos` com `status_pagamento = 'Faturado'` no `order_date` do dia
   - `vendedor_propostas` com `status IN ('FATURADO','APROVADA_FATURAMENTO','PAGO')` no `confirmado_em` (com fallback para `updated_at` quando `confirmado_em` for nulo) do dia
2. **Mercado Pago** — `ebd_shopify_pedidos_mercadopago` com `payment_status IN ('approved','PAGO')` ou `status='PAGO'`, no `created_at` do dia
3. **E-commerce** — `ebd_shopify_pedidos` com `status_pagamento = 'paid'` no `order_date` do dia
4. **Balcão Penha** — `vendas_balcao` com `status = 'finalizada'` no `created_at` do dia (canal **novo**, não existe hoje na função)
5. **Shopee** — `bling_marketplace_pedidos` com `marketplace = 'SHOPEE'` e `status_pagamento IN ('paid','Pago')` no `order_date` do dia
6. **Mercado Livre** — idem, `marketplace = 'MERCADO_LIVRE'`

Canais removidos da UI e dos totais: Faturamento Direto (separado), Nova Loja CG, Amazon, Atacado, ADVECS.

## Mudanças

### 1. Migration SQL — recriar `get_resumo_diario(date)`
- Substituir CTE `fat_direto` (atual) por `faturados_propostas` com os 3 status e usar `COALESCE(confirmado_em, updated_at)`.
- Adicionar CTE `balcao` lendo `vendas_balcao` (status `finalizada`).
- Filtrar `mkt` apenas para `SHOPEE` e `MERCADO_LIVRE` com status pago; quebrar em duas CTEs `mkt_shopee` e `mkt_ml`.
- Remover `nova_loja` e marketplaces não-marketplace dos totais.
- `totais_hoje.faturamento` e `pedidos` = soma somente das 6 CTEs acima.
- `totais_ontem` reescrito com a mesma lógica (mesmas 6 fontes).
- Saída `canais` (array) com exatamente 6 entradas:
  - `Faturados`, `Mercado Pago`, `E-commerce`, `Balcão Penha`, `Shopee`, `Mercado Livre`
- `vendedores_top5` e `mix_produtos` continuam considerando as fontes presentes (sem nova_loja). Balcão entra no ranking de vendedores via `vendas_balcao.vendedor_id`.
- Mantém `SECURITY DEFINER`, `STABLE`, checagem `has_role(auth.uid(),'admin')`.

### 2. Frontend — `src/pages/admin/ResumoDiario.tsx`
- Reduzir o array `CANAIS` para 6 entradas e renomear keys/labels para casar com os novos nomes do backend:
  - `faturados`, `mercado_pago`, `ecommerce`, `balcao_penha`, `shopee`, `mercado_livre`
- Atualizar `canalKeyMap` para os novos labels.
- Trocar grid para `lg:grid-cols-3` (6 cards ficam em 2 linhas de 3).
- Tipo `CanalKey` ajustado.

## Detalhes técnicos

- Os totais do topo (Faturamento, Pedidos, Ticket médio, Produtos vendidos) já vêm de `totais_hoje` na função SQL, então a mudança de CTEs já refaz tudo.
- Variação vs ontem usa `totais_ontem`, também refeito com as mesmas 6 fontes para consistência.
- `vendas_balcao.itens` (jsonb) é incluído no mix de produtos com a mesma lógica defensiva (`jsonb_typeof = 'array'`) já usada para `vendedor_propostas.itens` e `mp.items`.
- Nada muda em RLS, edge functions, cron de WhatsApp ou tabela de destinatários.
