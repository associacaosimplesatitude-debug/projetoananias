

## Plano Corrigido: Sub-abas em "Pedidos Confirmados"

### Correção
A aba "E-commerce Boleto" será renomeada para **"E-commerce"** — representa todos os pedidos Shopify independente da forma de pagamento.

### 5 Sub-abas

1. **Todos** — visão consolidada de todos os canais, com coluna "Canal"
2. **Faturados B2B** — `vendedor_propostas` (status FATURADO)
3. **Mercado Pago** — `ebd_shopify_pedidos_mercadopago` (approved/PAGO)
4. **E-commerce** — `ebd_shopify_pedidos` (todos os pedidos Shopify)
5. **Balcão Penha** — `vendas_balcao` (finalizada)

### Alterações em `AdminPedidosTab.tsx`

1. Adicionar queries para `ebd_shopify_pedidos_mercadopago` e `vendas_balcao`
2. Filtros (busca, vendedor, data) ficam **acima** das sub-abas, compartilhados
3. Cada aba com badge de contagem e valor total
4. Aba "Todos" mescla e ordena por data, com coluna "Canal"
5. Colunas adaptadas por canal (ex: Mercado Pago mostra payment_method, Balcão mostra forma_pagamento)
6. Stats cards no topo consolidam todos os canais

