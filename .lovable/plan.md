

## Plano: Adicionar coluna Bling na aba Faturados B2B

### Alteração

**Arquivo**: `src/components/admin/AdminPedidosTab.tsx`

1. **Header** (linha ~986): Adicionar `<TableHead>Bling</TableHead>` entre "Status" e "Vendedor"

2. **Body** (linha ~1014, após a célula de Status): Adicionar célula com badge Bling:
   - Se `proposta.bling_order_id` existe → badge verde com o ID
   - Se `proposta.sync_error` → badge amarelo "Erro sync"
   - Senão → badge azul "Enviado" (propostas faturadas são enviadas ao Bling automaticamente)

