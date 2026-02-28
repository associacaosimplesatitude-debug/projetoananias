

## Correção: Excluir pedidos faturados da aba E-commerce

### Problema
Pedidos B2B faturados criam automaticamente um registro em `ebd_shopify_pedidos` com `order_number` começando com `BLING-`. Isso faz com que apareçam na aba E-commerce indevidamente.

### Alteração

**Arquivo**: `src/components/admin/AdminPedidosTab.tsx` (linha ~563)

No filtro `filteredShopifyPedidos`, adicionar no início do `.filter()`:

```typescript
if (pedido.order_number?.startsWith('BLING-')) return false;
```

Isso exclui pedidos originados do faturamento B2B, que já aparecem na aba "Faturados B2B".

