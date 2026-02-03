

# Plano: Corrigir Sincronização para Preservar Vendedor Atribuído Manualmente

## Problema Identificado

Quando você atribui um vendedor manualmente, a sincronização automática (que roda ao abrir a página) sobrescreve o `vendedor_id` porque:

1. A edge function `ebd-shopify-sync-orders` faz um **upsert completo** de todos os dados
2. O `vendedor_id` extraído do Shopify (geralmente `null`) substitui o valor que você atribuiu no sistema
3. Isso faz com que o cliente "volte" para a lista de não atribuídos

### Fluxo Atual (Problemático)
```
1. Você atribui vendedor ao pedido → vendedor_id = "abc123"
2. Sincronização automática roda ao abrir página
3. Shopify retorna pedido com vendedor_id = null (ou outro valor)
4. Upsert sobrescreve → vendedor_id = null
5. Cliente volta para a lista de "não atribuídos"
```

## Solução

Modificar a edge function `ebd-shopify-sync-orders` para **verificar se o pedido já existe no banco com vendedor_id** antes de fazer o upsert. Se já tiver vendedor atribuído, manter o existente.

### Fluxo Corrigido
```
1. Você atribui vendedor ao pedido → vendedor_id = "abc123"
2. Sincronização automática roda ao abrir página
3. Edge function verifica: "esse pedido já tem vendedor_id?"
4. Se SIM → mantém o vendedor_id existente
5. Se NÃO → usa o vendedor_id do Shopify (ou null)
6. Cliente permanece atribuído
```

---

## Seção Técnica

### Arquivo a Modificar

`supabase/functions/ebd-shopify-sync-orders/index.ts`

### Alterações (linhas 295-343)

**Antes:**
```typescript
const rows = allOrders.map((order) => {
  const extracted = extractOrderData(order);
  // ... monta objeto com vendedor_id extraído do Shopify
  return {
    vendedor_id: extracted.vendedorId,
    // ... outros campos
  };
});

const { error } = await supabase
  .from("ebd_shopify_pedidos")
  .upsert(rows, { onConflict: "shopify_order_id", ignoreDuplicates: false });
```

**Depois:**
```typescript
// 1. Buscar pedidos existentes com vendedor_id atribuído
const shopifyOrderIds = allOrders.map(o => o.id);
const { data: existingOrders } = await supabase
  .from("ebd_shopify_pedidos")
  .select("shopify_order_id, vendedor_id, cliente_id")
  .in("shopify_order_id", shopifyOrderIds);

// Criar mapa de pedidos existentes
const existingOrdersMap = new Map<number, { vendedor_id: string | null; cliente_id: string | null }>();
if (existingOrders) {
  for (const order of existingOrders) {
    existingOrdersMap.set(order.shopify_order_id, {
      vendedor_id: order.vendedor_id,
      cliente_id: order.cliente_id
    });
  }
}

const rows = allOrders.map((order) => {
  const extracted = extractOrderData(order);
  
  // Verificar se já existe no banco
  const existing = existingOrdersMap.get(order.id);
  
  // PRIORIDADE: Manter vendedor_id existente no banco se já foi atribuído
  const finalVendedorId = existing?.vendedor_id || extracted.vendedorId;
  const finalClienteId = existing?.cliente_id || extracted.clienteId;
  
  return {
    shopify_order_id: order.id,
    vendedor_id: finalVendedorId,
    cliente_id: finalClienteId,
    // ... outros campos
  };
});

const { error } = await supabase
  .from("ebd_shopify_pedidos")
  .upsert(rows, { onConflict: "shopify_order_id", ignoreDuplicates: false });
```

### Lógica de Prioridade

| Cenário | vendedor_id no DB | vendedor_id no Shopify | Resultado |
|---------|-------------------|------------------------|-----------|
| Atribuído manualmente | "abc123" | null | "abc123" (mantém) |
| Atribuído manualmente | "abc123" | "xyz789" | "abc123" (mantém) |
| Novo pedido sem atribuição | null | null | null |
| Novo pedido com tag Shopify | null | "xyz789" | "xyz789" |

### Resultado Esperado

Após a correção:
- Vendedores atribuídos manualmente **nunca** serão sobrescritos pela sincronização
- Novos pedidos continuarão herdando vendedor das tags/atributos do Shopify
- O problema de duplicação/retorno de clientes será resolvido
- O contador de "Clientes para Atribuir" permanecerá estável

