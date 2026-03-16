

## Plano: Incluir pedidos órfãos sem erro na página de Sync Errors

### Problema
Existem pedidos MP pagos sem `bling_order_id` que também não têm `sync_error` registrado (a sincronização nunca foi tentada). Esses pedidos não aparecem na página de erros atual porque o filtro exige `sync_error IS NOT NULL`.

### Solução
Alterar a query na página `BlingSyncErrors.tsx` para incluir **todos** os pedidos pagos sem `bling_order_id`, independentemente de terem `sync_error` ou não.

### Alteração

**Arquivo:** `src/pages/admin/BlingSyncErrors.tsx`

- **Remover** o filtro `.not("sync_error", "is", null)`
- Manter os filtros: `status = 'PAGO'`, `bling_order_id IS NULL`, `created_at >= 2026-01-01`
- Na coluna "Erro", exibir "Sincronização não tentada" quando `sync_error` for null
- Alterar o título/descrição para refletir que mostra "pedidos pendentes de sincronização" (não apenas erros)

### Alteração no menu lateral

**Arquivo:** `src/components/admin/AdminEBDLayout.tsx`

- Atualizar a query de contagem para também remover o filtro `sync_error IS NOT NULL`, mantendo coerência com a página

### Escopo
- 2 arquivos editados
- Nenhuma tabela ou Edge Function alterada

