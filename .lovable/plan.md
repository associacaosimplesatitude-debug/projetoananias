## Problemas

### 1) Gerente clica em "Encaminhar" e nada acontece

Causa raiz: o botão "Encaminhar" abre o `EncaminharVendedorDialog` mesmo quando o contato **ainda não tem linha em `agente_ia_conversas`** (campo `conversaId = null` em `WhatsAppChat.tsx`). Ao clicar em "Encaminhar" no rodapé do dialog, a função `handleConfirm` faz:

```ts
if (!conversaId || !selected) return;
```

…e sai em silêncio. Nenhum toast, nenhum erro, nenhuma chamada RPC. Por isso "nada acontece".

A RPC `encaminhar_conversa_para_vendedor(_conversa_id, _vendedor_id)` exige um id existente em `agente_ia_conversas`. Para conversas que vieram só via webhooks/templates (sem registro no agente), esse id não existe ainda.

### 2) Vendedor está vendo todas as conversas "Sem vendedor"

Causa raiz: a lista de contatos do `WhatsAppChat` é construída a partir de `whatsapp_conversas` e `whatsapp_mensagens` (que não têm RLS restritiva por vendedor) e só depois é filtrada **no cliente** com:

```ts
if (scope === "vendedor" && vendedorId) {
  scoped = contactList.filter((c) => c.vendedorAtribuidoId === vendedorId);
}
```

Esse filtro é frágil: depende de `scope` e `vendedorId` chegarem corretamente ao componente e de o cliente carregar a lista inteira primeiro. Como a tela do vendedor mostra hoje vários contatos com a tag "Sem vendedor", o filtro está sendo ignorado/contornado, e o vendedor passa a enxergar a fila inteira.

A regra correta é: **o vendedor só pode ver conversas onde `agente_ia_conversas.vendedor_atribuido_id = vendedor_logado.id`** (que já é exatamente o que a RLS `vendedor_le_conversas_atribuidas` permite). Tudo o que não estiver atribuído a ele não pode aparecer na lista.

## Solução

### A) Corrigir encaminhamento do gerente

1. Atualizar a RPC `encaminhar_conversa_para_vendedor` para aceitar **conversa_id OU telefone**:
   - Nova assinatura: `encaminhar_conversa_para_vendedor(_vendedor_id uuid, _conversa_id uuid DEFAULT NULL, _telefone text DEFAULT NULL)`.
   - Se `_conversa_id` for nulo, faz upsert em `agente_ia_conversas` pelo telefone (cria a linha se não existir, com `status='pausada_humano'`, `agente_pausado=true`).
   - Em seguida aplica a mesma lógica de atribuição (atualiza atribuição e cria registro em `agente_ia_escalations`).
   - Mantém checagem de role (`admin`/`superadmin`/`gerente_ebd`).
2. Atualizar `EncaminharVendedorDialog` para receber também `telefone` e enviar ambos (conversaId quando existir, senão telefone). Remover o `return` silencioso quando não houver conversaId.
3. Em `WhatsAppChat.tsx`, passar `telefone={contact?.telefone}` para o dialog e exibir `toast.error` se a RPC retornar erro.

### B) Restringir o que o vendedor vê

No `WhatsAppChat.tsx`, quando `scope === "vendedor"`:
1. Buscar primeiro **somente** `agente_ia_conversas` onde `vendedor_atribuido_id = vendedorId`.
2. Derivar a lista de telefones a partir dessas conversas (usando `phoneVariants`).
3. Restringir as queries seguintes (`whatsapp_conversas`, `whatsapp_mensagens`, `whatsapp_webhooks`, `ebd_clientes`, `ebd_shopify_pedidos`, `ebd_leads_reativacao`) a esses telefones via `.in("telefone", ...)` / `.in("telefone_destino", ...)` / `.in("customer_phone", ...)`.
4. Se `vendedorId` for nulo, retornar lista vazia em vez de cair no caminho de admin.

Resultado: o vendedor só enxerga conversas que o gerente encaminhou para ele, mesmo que a RLS de `whatsapp_conversas` seja permissiva.

### Arquivos alterados

- `supabase/migrations/<nova>.sql` — nova versão da RPC `encaminhar_conversa_para_vendedor` com `telefone` opcional e upsert em `agente_ia_conversas`.
- `src/components/admin/whatsapp/EncaminharVendedorDialog.tsx` — aceitar `telefone`, deixar de abortar em silêncio, enviar conversa_id ou telefone para a RPC, mostrar toast em qualquer falha.
- `src/components/admin/WhatsAppChat.tsx` — passar `telefone` para o dialog; quando `scope === "vendedor"`, montar a lista de contatos a partir de `agente_ia_conversas` filtrada por `vendedor_atribuido_id`.

### Fora do escopo

- Não mexer em rotas, em `ProtectedRoute`, no botão "Atendimento" da sidebar, nem na lógica de pausa do agente.
- Não alterar políticas RLS existentes (a nova fonte de dados do vendedor já respeita a RLS atual).
- Não tocar no fluxo do superadmin/admin além de exibir toast de erro do encaminhamento.
