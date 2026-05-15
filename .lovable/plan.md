## Problema confirmado

Os dois cards estão errados pelas seguintes causas:

### 1. Faturados duplicados (Elaine R$ 28.958,86 = 2× R$ 14.479,38)

A venda da PLENITUDE (Elaine) existe nas **duas tabelas** com o mesmo `bling_order_id`:
- `ebd_shopify_pedidos` — status `Faturado`, R$ 14.479,48
- `vendedor_propostas` — status `FATURADO`, R$ 14.479,38

A função `get_resumo_diario` soma as duas, dobrando o valor (e duplicando no Top vendedores).

### 2. Shopee e Mercado Livre zerados

Os pedidos de hoje em `bling_marketplace_pedidos` estão com `status_pagamento = 'Desconhecido'` (não `paid`/`Pago`). A função filtra por `paid/Pago` e zera tudo. O dashboard "Resumo de Vendas" (que o usuário pediu como fonte) **não filtra por status** — mostra Shopee R$ 317,20 e ML R$ 76,65 mesmo assim.

## Plano

Migration recriando `get_resumo_diario(data_ref)` com dois ajustes:

### A) Dedupe Faturados por `bling_order_id`

```text
faturados = UNION das duas fontes, mas:
  - se o mesmo bling_order_id aparece nos dois lados, manter apenas
    o registro de vendedor_propostas (preferir, pois tem itens estruturados
    e vendedor garantido)
  - registros sem bling_order_id entram normalmente
```

Implementação: CTE `faturados_unificados` que faz `FULL OUTER JOIN` por `bling_order_id` quando ambos têm valor, ou `LEFT ANTI JOIN` para incluir os órfãos. Substitui `faturados_shopify` + `faturados_propostas` em todos os agregados (KPIs, vendedores_top5, mix_produtos).

### B) Shopee/ML sem filtro de status

Remover `AND status_pagamento IN ('paid','Pago')` das CTEs `mkt_shopee` e `mkt_ml`. Manter apenas:
- `marketplace = 'SHOPEE'` / `'MERCADO_LIVRE'`
- `(created_at AT TIME ZONE 'America/Sao_Paulo')::date = data_ref`

Aplicar a mesma mudança em `totais_ontem`.

### Não muda
- Frontend (`ResumoDiario.tsx`)
- E-commerce, Mercado Pago, Balcão Penha (já corretos)
- RLS, edge functions, cron

### Resultado esperado para 15/05

| Card | Antes | Depois |
|---|---|---|
| Faturados | R$ 28.958,86 (2 pedidos) | R$ 14.479,38 (1 pedido) |
| Shopee | R$ 0,00 | R$ 317,20 (5 pedidos) |
| Mercado Livre | R$ 0,00 | R$ 76,65 (2 pedidos) |
| Top vendedor Elaine | R$ 28.958,86 | R$ 14.479,38 |
