

## Problema

A seção "Vendas de Hoje" não busca dados da tabela `ebd_shopify_pedidos_mercadopago`. Os pedidos Mercado Pago (como Assembleia de Deus Una, KATIA CILENE de Souza, Igreja Cristã Evangélica Ministério de Cristo) aparecem nos "Pedidos Confirmados" na aba Mercado Pago, mas não aparecem no card de "Vendas de Hoje" porque essa fonte de dados simplesmente não é consultada.

As 5 fontes atuais são:
1. `ebd_shopify_pedidos_cg` (E-commerce CG)
2. `ebd_shopify_pedidos` (Shopify B2B)
3. `vendedor_propostas` (Propostas/Faturados)
4. `vendas_balcao` (PDV Balcão)
5. `bling_marketplace_pedidos` (Marketplaces)

Falta a 6a fonte: **`ebd_shopify_pedidos_mercadopago`** (Mercado Pago).

---

## Solução

**Arquivo: `src/pages/admin/ComissaoAlfaMarketing.tsx`**

Adicionar query à tabela `ebd_shopify_pedidos_mercadopago` na função `vendas-hoje`, entre as queries de Propostas e PDV Balcão:

- Select: `cliente_nome, valor_total, created_at, status, cliente_id, vendedor_id`
- Filtro: `status = 'PAGO'`, `created_at` entre `todayStart` e `todayEnd`
- Para cada pedido MP:
  - Resolver cliente via `clienteMap` usando `cliente_id`
  - Resolver vendedor via `resolveVendedor`
  - Canal: "Mercado Pago"
  - Calcular comissão: `valor * COMMISSION_RATE`

Isso alinha o "Vendas de Hoje" com as mesmas 6 fontes do "Pedidos Confirmados", garantindo que todos os pedidos do dia apareçam.

