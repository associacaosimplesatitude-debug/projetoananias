

## Plano: Mostrar pedidos com status PAGO na aba "Pedidos Confirmados"

### Problema

O pedido da Livraria Foco Gospel foi confirmado com sucesso (status `PAGO`, Bling order criado, comissão gerada), mas **não aparece na aba "Pedidos Confirmados"** porque a query dessa aba filtra apenas `["FATURADO", "APROVADA_FATURAMENTO"]`, excluindo `PAGO`.

### Correção

**Arquivo: `src/components/admin/AdminPedidosTab.tsx`** (linha ~232)

Adicionar `"PAGO"` ao filtro de status na query de propostas faturadas:

```typescript
// ANTES
.in("status", ["FATURADO", "APROVADA_FATURAMENTO"])

// DEPOIS
.in("status", ["FATURADO", "APROVADA_FATURAMENTO", "PAGO"])
```

Isso fará com que pedidos pagos via cartão de crédito (confirmados manualmente) apareçam na aba "Pedidos Confirmados" junto com os faturados.

