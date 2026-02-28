

## Plano: Corrigir exibição Bling nos Pedidos E-commerce + Investigar ADVEC VILA KELSON

### Problema 1: E-commerce mostrando "Não enviado" incorretamente

Os pedidos do e-commerce (Shopify) são automaticamente integrados ao Bling pela integração nativa do Shopify. Porém, o campo `bling_order_id` na tabela `ebd_shopify_pedidos` nunca foi preenchido para a maioria dos pedidos (1.506 pedidos com `bling_order_id = NULL`). A UI mostra "Não enviado" quando esse campo está vazio, o que é **incorreto** para pedidos do e-commerce.

**Solução**: Alterar a lógica da coluna Bling na aba E-commerce em `AdminPedidosTab.tsx`:
- Se `bling_order_id` existe: mostrar badge verde com o ID (como hoje)
- Se `bling_order_id` é null E o pedido é pago/faturado: mostrar badge azul "Enviado" (em vez de "Não enviado"), pois pedidos e-commerce são automaticamente enviados ao Bling pela integração Shopify
- Manter "Erro sync" para pedidos com `sync_error`

### Problema 2: ADVEC VILA KELSON - 27/02/2026

Investiguei no banco e o pedido **existe e está correto**:
- **`vendedor_propostas`**: ID `3f2b1960`, status FATURADO, `bling_order_id = 25186188651`, criado 27/02 às 19:43
- **`ebd_shopify_pedidos`**: order_number `BLING-25186188651`, `bling_order_id = 25186188651`, criado 27/02 às 19:45

O pedido está no Bling (ID 25186188651). A hora registrada é **19:45** (não 16:45 como mencionado). O `bling_status` está null porque o sync de status ainda não atualizou — isso é normal e será preenchido na próxima execução do `bling-sync-order-status`.

**Nenhuma correção necessária** para este pedido — ele está devidamente vinculado ao Bling.

### Alterações no código

**Arquivo**: `src/components/admin/AdminPedidosTab.tsx`

1. Na aba E-commerce (linha ~1192-1200), trocar a lógica do badge Bling:
   - Pedidos pagos/faturados sem `bling_order_id` e sem `sync_error` → mostrar badge azul "Enviado" (confiança na integração Shopify-Bling)
   - Manter badge verde com ID quando `bling_order_id` existe
   - Manter badge amarelo para `sync_error`

