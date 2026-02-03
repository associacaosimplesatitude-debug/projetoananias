
# Plano: Corrigir Ranking de Vendedores - Dados Zerados

## Problemas Identificados

Ao selecionar 02/02/2026, o ranking mostra R$ 0,00 para todos os vendedores, quando deveria mostrar valores significativos.

### Causa Raiz 1: Status "Faturado" não reconhecido

A função `isPaidStatus` no componente `VendedoresSummaryCards.tsx` verifica apenas:
- `paid`, `pago`, `aprovado`, `approved`

Mas os pedidos têm `status_pagamento = 'Faturado'` (7 pedidos totalizando R$ 10.713,71)

### Causa Raiz 2: Pedidos Mercado Pago não incluídos

O componente `VendedoresSummaryCards` recebe e processa apenas:
- `shopifyOrders` (da tabela `ebd_shopify_pedidos`)
- `blingOrders` (da tabela `bling_marketplace_pedidos`)
- `propostasFaturadas`

Mas NÃO inclui os pedidos de `ebd_shopify_pedidos_mercadopago` que têm vendas significativas:
- Neila: R$ 2.516,52
- Elaine: R$ 862,16
- Daniel: R$ 268,23

## Valores Corretos para 02/02/2026

| Vendedor | Shopify + Faturado | Mercado Pago | Total |
|----------|-------------------|--------------|-------|
| Gloria Carreiro | R$ 9.218,67 | R$ 0,00 | R$ 9.218,67 |
| Neila | R$ 898,50 | R$ 2.516,52 | R$ 3.415,02 |
| Elaine Ribeiro | R$ 204,27 | R$ 862,16 | R$ 1.066,43 |
| Daniel | R$ 392,27 | R$ 268,23 | R$ 660,50 |

## Solução Proposta

### 1. Adicionar "Faturado" e "faturado" na função isPaidStatus

```typescript
const isPaidStatus = (status: string | null | undefined): boolean => {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === "paid" || s === "pago" || s === "aprovado" || s === "approved" || s === "faturado";
};
```

### 2. Adicionar prop para pedidos Mercado Pago

Modificar o componente para:
- Receber `mercadoPagoOrders` como nova prop
- Processar esses pedidos no ranking (com filtro `payment_status === 'approved'`)
- Somar ao total de vendas de cada vendedor

### 3. Buscar e passar os pedidos Mercado Pago

No `AdminEBD.tsx`, adicionar query para buscar `ebd_shopify_pedidos_mercadopago` e passar para o componente `VendedoresSummaryCards`.

---

## Seção Técnica

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/admin/VendedoresSummaryCards.tsx` | Adicionar "faturado" no isPaidStatus + nova prop mercadoPagoOrders + processar no ranking |
| `src/pages/admin/AdminEBD.tsx` | Buscar ebd_shopify_pedidos_mercadopago e passar como prop |

### Fluxo de Dados Atualizado

```text
AdminEBD.tsx
    |
    +-- useQuery("admin-mercadopago-orders")
    |       -> ebd_shopify_pedidos_mercadopago
    |
    +-- VendedoresSummaryCards
            props:
              - vendedores
              - shopifyOrders         <- ebd_shopify_pedidos
              - blingOrders           <- bling_marketplace_pedidos
              - propostasFaturadas
              - mercadoPagoOrders     <- ebd_shopify_pedidos_mercadopago (NOVO)
```

### Alterações Detalhadas

**1. VendedoresSummaryCards.tsx - linha 107-111**
```typescript
const isPaidStatus = (status: string | null | undefined): boolean => {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === "paid" || s === "pago" || s === "aprovado" || s === "approved" || s === "faturado";
};
```

**2. VendedoresSummaryCards.tsx - Interface props (linha ~59-64)**
Adicionar nova interface e prop para pedidos Mercado Pago

**3. VendedoresSummaryCards.tsx - rankingData useMemo (linha ~346-418)**
Adicionar processamento dos pedidos Mercado Pago:
```typescript
// Process Mercado Pago orders
mercadoPagoOrders.forEach(order => {
  if (!order.vendedor_id || order.payment_status !== 'approved') return;
  
  const orderDate = order.created_at ? parseISO(order.created_at) : null;
  if (!orderDate) return;

  const vendedorData = vendedorSales.get(order.vendedor_id);
  if (!vendedorData) return;

  if (isWithinInterval(orderDate, { start: dateRange.start, end: dateRange.end })) {
    vendedorData.vendas += Number(order.valor_total || 0);
  }
});
```

**4. AdminEBD.tsx - Nova query (~linha 326)**
```typescript
const { data: mercadoPagoOrders = [] } = useQuery({
  queryKey: ["admin-mercadopago-orders"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("ebd_shopify_pedidos_mercadopago")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },
});
```

**5. AdminEBD.tsx - Passar prop (~linha 1645-1650)**
```typescript
<VendedoresSummaryCards
  vendedores={vendedores || []}
  shopifyOrders={shopifyOrders}
  blingOrders={marketplacePedidos}
  propostasFaturadas={propostasFaturadasMeta}
  mercadoPagoOrders={mercadoPagoOrders}  // NOVO
/>
```

### Resultado Esperado

Após a implementação:
- Gloria Carreiro aparecerá com R$ 9.218,67
- Neila aparecerá com R$ 3.415,02
- Elaine Ribeiro aparecerá com R$ 1.066,43
- Daniel aparecerá com R$ 660,50
- O total de vendas realizadas será R$ 14.360,62
