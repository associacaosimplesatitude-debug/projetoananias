

# Ajustes na Página Atribuir Clientes

## Resumo das Alterações

| # | Alteração | Local |
|---|-----------|-------|
| 1 | Mudar texto do subtítulo | Linha 403 |
| 2 | Filtrar pedidos de Dezembro/2025 até hoje | Query principal (linhas 268-279) |

---

## Arquivo a Modificar

**`src/pages/shopify/PedidosOnline.tsx`**

### Alteração 1: Atualizar Texto do Subtítulo

**Linha 403**

De:
```tsx
<p className="text-muted-foreground">Pedidos pagos finalizados via Shopify</p>
```

Para:
```tsx
<p className="text-muted-foreground">Pedidos pagos finalizados via E-commerce</p>
```

---

### Alteração 2: Filtrar Pedidos a partir de Dezembro de 2025

Adicionar filtro na query do Supabase para trazer apenas pedidos com `order_date` ou `created_at` >= `2025-12-01`.

**Linhas 268-279** (query principal)

De:
```tsx
const { data, error } = await supabase
  .from("ebd_shopify_pedidos")
  .select(`...`)
  .neq("status_pagamento", "Faturado")
  .is("vendedor_id", null)
  .order("created_at", { ascending: false });
```

Para:
```tsx
const { data, error } = await supabase
  .from("ebd_shopify_pedidos")
  .select(`...`)
  .neq("status_pagamento", "Faturado")
  .is("vendedor_id", null)
  .gte("created_at", "2025-12-01T00:00:00.000Z")
  .order("created_at", { ascending: false });
```

---

## Resultado Esperado

1. **Subtítulo** mostrará "Pedidos pagos finalizados via E-commerce" em vez de "via Shopify"

2. **Listagem** exibirá apenas pedidos a partir de 01/12/2025 até a data atual, ignorando pedidos anteriores

---

## Seção Técnica

### Por que usar `gte` na query?

Adicionar o filtro `.gte("created_at", "2025-12-01T00:00:00.000Z")` diretamente na query do Supabase é mais eficiente que filtrar no frontend, pois:
- Reduz a quantidade de dados transferidos
- Melhora a performance para grandes volumes de pedidos
- Garante que a paginação funcione corretamente

O campo `created_at` é utilizado como referência principal já que `order_date` pode ser nulo em alguns casos.

