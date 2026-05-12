## Diagnóstico — não é coincidência

Comparei os pedidos de hoje (12/05) com os anteriores. Padrão muito claro:

| Dia | Total pagos | Foram p/ Bling | Falharam |
|---|---|---|---|
| 04/05 | 11 | 5 | 0 |
| 05/05 | 15 | 7 | 0 |
| 06/05 | 12 | 3 | 0 |
| 08/05 | 21 | 11 | 0 |
| **11/05** | **12** | **4** | **0** |
| **12/05** | **8** | **0** | **4** |

**Hoje começou a falhar em massa. Antes, nunca.**

Olhando os pedidos que você citou (todos OK ontem):

| Cliente | CPF/CNPJ | Tel | Bling |
|---|---|---|---|
| Cibelle Stirling 11/05 19:15 | 70283234474 | 35192221139 | ✅ 25786441801 |
| Pedro Moraes 11/05 16:38 | 00332019780 | 21986539638 | ✅ 25784063132 |
| Júlio da Silva 11/05 15:34 | 10236231707 | 21969973651 | ✅ 25783388239 |

E os de hoje (todos falhando com a mesma mensagem genérica):

| Cliente | CPF/CNPJ | Tel | Bling |
|---|---|---|---|
| Symone 12/05 12:56 | 26074656215 | 9180664383 | ❌ |
| Marcelo Alves 12/05 11:05 | 29996296806 | 11995966225 | ❌ |
| IGREJA AD 12/05 09:31 | 02665390000144 | 21984137421 | ❌ |
| IGREJA AD 12/05 09:28 | 02665390000144 | 21984137421 | ❌ |

Os dados (telefone, CPF, endereço) **não são piores que os de ontem**. Marcelo e IGREJA têm telefones perfeitamente válidos. Symone tem 10 dígitos (só 1 dígito a menos), mas comprou várias vezes antes (último pedido OK em 05/05 com o mesmo telefone).

## Causa raiz provável

Hoje cedo deployamos a troca de host em todas as 30 funções Bling: `https://www.bling.com.br` → `https://api.bling.com.br`. **O timing bate exatamente com o início das falhas.**

A mensagem `"Falha ao criar contato no Bling. Verifique os dados do cliente."` é uma string **nossa** (linha 1371 de `bling-create-order/index.ts`) — o erro real do Bling foi descartado com `console.log` e não está em lugar nenhum.

Hipótese mais provável: o endpoint `api.bling.com.br/Api/v3/contatos` está mais estrito que o `www.bling.com.br` — provavelmente exige algum campo no payload (ex: `tiposContato`, validação de DDD, ou algo no `endereco.geral`) que o host antigo aceitava com fallback. Sem o corpo bruto da resposta do Bling, é só especulação.

## Plano

### 1. Capturar o erro REAL do Bling (sem isso, vamos chutar)

Em `supabase/functions/bling-create-order/index.ts`, no bloco de criação de contato (~linhas 1313-1373), trocar o `throw` genérico por um que inclua o corpo da resposta do Bling:

```ts
// no fallback final do passo 5
if (!contatoId) {
  const blingMsg =
    createResult?.error?.description ||
    createResult?.error?.message ||
    JSON.stringify(createResult);
  console.error('[CONTATO] ERRO CRÍTICO:', blingMsg);
  throw new Error(`Falha ao criar contato no Bling: ${blingMsg}`);
}
```

E em `mp-sync-payment-status/index.ts` linha 222, aumentar o `slice(0, 200)` para `slice(0, 1500)` para que o `sync_error` salvo já contenha a mensagem detalhada.

### 2. Reprocessar 1 pedido pra ver a mensagem real

Depois do deploy de (1), invocar `mp-sync-payment-status` para o pedido da Symone (`d1cd8bab-…`). O `sync_error` resultante vai conter o motivo exato do Bling. Aí decidimos a correção definitiva (campo extra no payload, sanitização, etc.) com base em fato, não em palpite.

### 3. Botão "Reprocessar Bling" no admin

Em `src/components/admin/AdminPedidosTab.tsx`, na aba **Mercado Pago**, na coluna `Bling`:
- Quando `bling_order_id` está vazio: trocar/complementar o badge "Erro" por um botão pequeno **"Reprocessar"** que invoca `mp-sync-payment-status` com `{ pedido_id }`.
- Em sucesso: invalidar `["admin-mercadopago-pedidos"]` e toast verde.
- Em falha: toast com o `sync_error` retornado (agora detalhado, graças ao passo 1).
- Tooltip no badge "Erro" mostrando o `sync_error` completo.

### 4. Botão "Reprocessar todos com erro" no header da aba

Itera sobre todos os pedidos `payment_status='approved' AND bling_order_id IS NULL` (com delay 1s entre chamadas, padrão `admin-bulk-processing-pattern`).

### 5. Atualizar memória

Atualizar `mem://integrations/bling-contact-validation-constraints` com a aprendizagem: "Se HTTP 500 em `/contatos`, capturar `error.description` do Bling — a mensagem genérica nossa esconde o motivo real."

## Fora do escopo neste plano

- **Não vou reverter o `api.bling.com.br`** — o `www.bling.com.br` está bloqueado pelo Bling oficialmente. A solução é descobrir o que o novo endpoint exige a mais e ajustar o payload.
- Sem o passo (1) qualquer alteração no payload do contato é chute. Por isso (1) e (2) vêm primeiro, e só depois ajustamos.

Posso executar (1), (2), (3), (4) e (5) em sequência?