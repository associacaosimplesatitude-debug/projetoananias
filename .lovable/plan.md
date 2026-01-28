
# Correção: NF-es 019146 e 019147 Não Aparecem em "Notas Emitidas"

## Diagnóstico

### Problema Identificado

As NF-es **019146** e **019147** foram geradas com sucesso no Bling, mas os registros correspondentes **nunca foram inseridos** na tabela `vendas_balcao`. Isso ocorre porque:

1. O teste foi feito via **impersonation** (Elielson acessando como Gloria)
2. O código frontend tenta inserir em `vendas_balcao` com `vendedor_id` da Gloria
3. A RLS policy de INSERT verifica: `email do usuário autenticado = email do vendedor`
4. Como Elielson não é vendedor, a RLS policy **bloqueia silenciosamente** o insert

### Fluxo do Problema

```text
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO ATUAL (COM BUG)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Elielson (admin) ──► Impersona Gloria ──► useVendedor()       │
│                                              retorna Gloria OK  │
│                                                                 │
│   Cria pedido Bling ✓                                           │
│   Gera NF-e (019146, 019147) ✓                                  │
│                                                                 │
│   INSERT vendas_balcao (vendedor_id = Gloria)                   │
│        │                                                        │
│        ▼                                                        │
│   RLS Policy verifica: get_auth_email() = ?                     │
│        │                                                        │
│        ▼                                                        │
│   elielson@... ≠ glorinha21carreiro@gmail.com ❌                 │
│        │                                                        │
│        ▼                                                        │
│   INSERT BLOQUEADO (silenciosamente)                            │
│                                                                 │
│   Notas Emitidas: vazio                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Soluções Propostas

### Opção 1: Mover o Insert para a Edge Function (RECOMENDADO)

Em vez de inserir `vendas_balcao` no frontend (que está sujeito a RLS), mover o insert para a edge function `bling-create-order` que usa o service role key e não tem restrições de RLS.

| Prós | Contras |
|------|---------|
| Garantia de que o registro será criado | Requer alterar edge function |
| Não depende de RLS | - |
| Funciona com impersonation | - |

### Opção 2: Ajustar RLS para Permitir Admins/Gerentes

Adicionar uma condição na RLS policy de INSERT para permitir que admins e gerentes insiram em nome de vendedores.

| Prós | Contras |
|------|---------|
| Solução simples no banco | Pode abrir brechas de segurança |
| Menos código | - |

---

## Implementação (Opção 1 - Recomendada)

### Alterações no arquivo `supabase/functions/bling-create-order/index.ts`

Após criar o pedido no Bling com sucesso e antes de retornar a resposta, inserir o registro em `vendas_balcao` usando o cliente Supabase com service role.

**Novo código a adicionar (após linha ~900 onde o pedido é criado):**

```typescript
// Para fluxo "Pagar na Loja", inserir em vendas_balcao usando service role
if (isPagamentoLoja && blingOrderId && vendedorId) {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  await supabaseAdmin.from('vendas_balcao').insert({
    vendedor_id: vendedorId,
    polo: depositoOrigem === 'local' ? 'penha' : (depositoOrigem === 'matriz' ? 'matriz' : 'pernambuco'),
    bling_order_id: blingOrderId,
    cliente_nome: cliente.nome,
    cliente_cpf: cliente.cpf_cnpj,
    cliente_telefone: cliente.telefone,
    valor_total: valorTotal,
    forma_pagamento: formaPagamentoLoja || 'pix',
    status: 'finalizada',
    status_nfe: 'CRIADA',
  });
}
```

### Remover Insert do Frontend

No arquivo `src/pages/shopify/ShopifyPedidos.tsx`, remover o bloco de insert em `vendas_balcao` (linhas 1577-1597), pois agora será feito pela edge function.

---

## Correção Imediata para NF-es 019146 e 019147

Como essas NF-es já foram geradas mas os registros não existem, será necessário inserir manualmente os dados para que apareçam na lista.

**Dados a inserir:**

| NF-e | Bling Order ID | Cliente | Tipo |
|------|----------------|---------|------|
| 019146 | 24939744400 | Igreja Assembleia de Deus Balsamo de Gileade | CNPJ |
| 019147 | 24939829731 | Bruna Soares silva | CPF |

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/bling-create-order/index.ts` | Adicionar insert em vendas_balcao para fluxo "Pagar na Loja" |
| `src/pages/shopify/ShopifyPedidos.tsx` | Remover insert redundante do frontend |
| Banco de dados | Inserir registros manuais das NF-es 019146 e 019147 |

---

## Resultado Esperado

Após a implementação:
- Registros em `vendas_balcao` serão criados pela edge function (sem restrição RLS)
- Impersonation funcionará corretamente para criar pedidos "Pagar na Loja"
- NF-es 019146 e 019147 aparecerão na lista após inserção manual
- Futuros pedidos via "Pagar na Loja" serão salvos corretamente
