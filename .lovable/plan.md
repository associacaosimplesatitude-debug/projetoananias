

## Alterar filtro de data na página Atribuir Clientes

Mudança simples em **1 arquivo**:

**Arquivo:** `src/pages/shopify/PedidosOnline.tsx` — linha 296

**De:**
```typescript
.gte("created_at", "2025-12-01T00:00:00.000Z")
```

**Para:**
```typescript
.gte("created_at", "2026-01-01T00:00:00.000Z")
```

Isso fará a página `/admin/ebd/pedidos-igrejas` exibir apenas pedidos a partir de 1º de janeiro de 2026.

