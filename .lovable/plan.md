

## Plano: Página de Erros de Sincronização Bling (MP)

### 1. Criar página `src/pages/admin/BlingSyncErrors.tsx`

Nova página que:
- Busca de `ebd_shopify_pedidos_mercadopago` com filtro `bling_order_id IS NULL AND sync_error IS NOT NULL AND status = 'PAGO'`
- Exibe tabela com colunas: Pedido (id curto), Cliente (nome/email), Valor, Data, Tentativas, Erro, Ações
- Botão vermelho "Reenviar" em cada linha que chama `supabase.functions.invoke('mp-sync-orphan-order', { body: { pedido_id: row.id } })`
- Após reenvio: refetch da query. Se `bling_order_id` preenchido = badge verde "Sincronizado". Se novo `sync_error` = mostra erro atualizado
- Usa `useQuery` + `useMutation` do tanstack/react-query
- Exibe toast de sucesso/erro via sonner

### 2. Adicionar rota em `src/App.tsx`

- Import do novo componente
- Nova `<Route path="sync-errors" element={<BlingSyncErrors />} />` dentro do bloco `/admin/ebd`

### 3. Adicionar item no menu lateral `src/components/admin/AdminEBDLayout.tsx`

- Nova query para contar registros com erro de sync (`bling_order_id IS NULL AND sync_error IS NOT NULL AND status = 'PAGO'`)
- Novo item de menu na seção "Operacional" com ícone `AlertTriangle` (vermelho via `text-red-500`)
- Badge com contagem de erros, visível apenas quando `count > 0`
- Link para `/admin/ebd/sync-errors`

### Arquivos modificados
- **Criado**: `src/pages/admin/BlingSyncErrors.tsx`
- **Editado**: `src/App.tsx` (import + rota)
- **Editado**: `src/components/admin/AdminEBDLayout.tsx` (query + item menu)

