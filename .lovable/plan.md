# Fix: nome do vendedor sumindo (embed PostgREST retorna null)

## Causa real

A consulta `select("..., vendedores(id, nome)")` retorna **`vendedores: null`** mesmo quando `vendedor_id` está preenchido (confirmado via REST). O embed da tabela `vendedores` está sendo bloqueado, então `vendedorNome=null` e a tag continua como **"Novo contato"**.

## Solução (apenas leitura, sem mexer em comissões/cadastros)

Substituir os embeds por uma única query extra em `vendedores` pelos IDs coletados.

### Mudanças em `src/components/admin/WhatsAppChat.tsx`

1. Remover `vendedores(id, nome)` dos selects:
   - `ebd_leads_reativacao` → `select("telefone, vendedor_id")`
   - `ebd_clientes` → `select("id, telefone, vendedor_id, updated_at")`

2. Coletar todos `vendedor_id` (de `agente_ia_conversas.vendedor_atribuido_id`, `ebd_clientes.vendedor_id`, `ebd_leads_reativacao.vendedor_id`) e fazer:
   ```ts
   const { data: vendedoresRows } = await supabase
     .from("vendedores").select("id, nome").in("id", vendedorIds);
   const vendedorById: Record<string,string> = {};
   ```

3. Resolver os nomes via `vendedorById[id]` em vez dos embeds (`l.vendedores?.nome`, `c.vendedores?.nome`, `row.vendedor_atribuido?.nome`, `row.cliente?.vendedor?.nome`).

## Garantias

- Apenas SELECT — nada de INSERT/UPDATE/DELETE.
- **Sem migration**, sem mudar RLS, sem edge functions.
- **Não toca** comissões, cadastros de cliente, vendas, leads.
- 1 query extra (`vendedores`) por carga da lista.
