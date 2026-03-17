

## Plan: Enable commission approval for EBD managers

### What changes

**`src/pages/shopify/PedidosCentralGospel.tsx`** — Single change:

Replace:
```typescript
const isAdmin = role === 'admin';
```
With:
```typescript
const isAdmin = role === 'admin' || role === 'gerente_ebd';
```

This will enable all `isAdmin`-gated features on this page (select all pending, approve commissions, sync button, action columns) for `gerente_ebd` users as well.

Both `gabriel.lourenco` and `elielson` already have the `gerente_ebd` role, so no database changes are needed.

### Risk

Low — this only affects the Pedidos Central Gospel page. The `gerente_ebd` role already has access to the Admin EBD panel and can view this page; this change simply unlocks the approval controls.

