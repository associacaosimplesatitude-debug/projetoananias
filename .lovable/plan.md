## Diagnóstico

Analisei a proposta do Genilton Amâncio Tavares (token `8d9f2953-...` e anteriores) e o que acontece é o seguinte.

### 1. Os dados estão CORRETOS no banco e no backend ✅

Banco (`vendedor_propostas`):
- `valor_produtos = R$ 348,00`
- `desconto_percentual = 15%`
- `valor_total = R$ 295,80`
- `itens` contém os 2 produtos com `quantity: 20` e `quantity: 8`

Testei a edge function `mp-checkout-init` chamando direto e ela retorna a resposta certa (valores e array de itens corretos). Ou seja, **o problema não é falta de dado** — o servidor está respondendo corretamente.

### 2. Os 6 pedidos do Genilton ESTÃO sendo criados, mas o pagamento é recusado pelo Mercado Pago ❌

Tabela `ebd_shopify_pedidos_mercadopago` mostra **6 tentativas hoje** todas com:
- `valor_total = R$ 295,80` (valor correto, recalculado pelo backend)
- `payment_method = card`
- `status = AGUARDANDO_PAGAMENTO`
- `payment_status = pending`
- `mercadopago_payment_id = vazio` (MP nunca devolveu ID de pagamento)

Isso significa que a edge function `mp-create-order-and-pay`:
1. Recebe o request do cliente
2. Cria o pedido local com o valor correto
3. Chama o Mercado Pago
4. Mercado Pago **rejeita** o cartão (provavelmente `cc_rejected_high_risk` por antifraude depois de várias tentativas, `cc_rejected_other_reason` ou cartão sem limite/inválido)
5. A função devolve um erro amigável, mas o pedido fica órfão na tabela

Como nós não vemos isso em teste é simples: o cartão de teste não cai em antifraude. O cartão real do Genilton está sendo barrado pela operadora ou pelo antifraude do Mercado Pago.

### 3. Por que o cliente vê R$ 0,00 nos prints

Como a página renderiza a tela antes do `checkoutData` chegar (e a query usa o token via edge function), durante o carregamento `proposta` fica `null` e `checkoutItems.length` = 0, `subtotal` = 0. Se a chamada à edge function falha por qualquer motivo transitório (rede do cliente, JWT expirado no `auth/getUser`, ou timeout), a tela permanece em "R$ 0,00" mas mostra os itens da proposta (esses vêm de outro fluxo de cache do React Query).

Não há tratamento visível de erro: hoje o `useQuery` falha em silêncio. O cliente clica em "Finalizar Pedido" mesmo com R$ 0 e a função `mp-create-order-and-pay` recalcula o valor real (R$ 295,80) no servidor e tenta cobrar. Por isso vemos pedidos de R$ 295,80 sendo criados mesmo o cliente vendo R$ 0.

## Plano de correção

### Passo 1 — Mostrar erro/loader claro quando o checkout não conseguir carregar
Em `src/pages/ebd/CheckoutShopifyMP.tsx`:
- Mostrar um loader enquanto `isLoadingCheckout` for verdadeiro, em vez de já renderizar o resumo com R$ 0,00.
- Se `checkoutError` ocorrer, exibir uma tela de erro com botão "Tentar novamente" em vez de deixar o cliente clicar em Finalizar com valores zerados.
- Desabilitar o botão "Finalizar Pedido" quando `subtotal <= 0` ou `checkoutItems.length === 0`, com tooltip "Aguardando carregamento do pedido…".

### Passo 2 — Logar e expor o motivo da recusa do Mercado Pago para o cliente
Hoje a função já mapeia `status_detail` para mensagens amigáveis (`cc_rejected_high_risk`, etc.), mas o cliente provavelmente está vendo só "Erro ao processar pagamento" porque o catch genérico no front engole o detalhe.

Em `processCardPayment` (CheckoutShopifyMP.tsx), exibir a mensagem retornada por `result.error` em um toast de longa duração e também num bloco persistente abaixo do formulário, para que o cliente saiba o motivo (ex.: "Cartão recusado pelo antifraude — tente outro cartão ou pague via PIX").

### Passo 3 — Limpar pedidos órfãos automaticamente
Hoje, cada clique em Finalizar gera um pedido `AGUARDANDO_PAGAMENTO` sem `mercadopago_payment_id` que nunca será pago — poluindo o admin e contando errado em relatórios.

Opções (escolher uma na hora de implementar):
- **A)** Só inserir o pedido em `ebd_shopify_pedidos_mercadopago` **depois** do MP devolver `payment_id` ✅ (corrigir de verdade)
- **B)** Manter ordem atual, mas no catch de rejeição, deletar o pedido recém-criado (ou marcá-lo `status = REJEITADO`)
- Recomendo **A** — apenas reordenar a função: criar pedido após sucesso da chamada MP.

### Passo 4 — Fazer um cleanup dos 6 pedidos órfãos do Genilton
Atualizar os 6 pedidos do Genilton sem `mercadopago_payment_id` (criados hoje) para `status = REJEITADO` ou apagá-los, para não atrapalhar relatórios de retenção/comissão.

### Passo 5 — Sugerir ao Genilton pagar via PIX
A causa raiz é o cartão dele. Vendo o histórico, **PIX está funcionando 100%** para outros clientes hoje (vários `f7977e10-...`, `722a3cfc-...`, `8a660998-...` aprovados). Recomendar ao vendedor que a Elaine peça ao Genilton para finalizar via PIX em vez de cartão.

## Arquivos que serão tocados

- `src/pages/ebd/CheckoutShopifyMP.tsx` — loader/erro robustos, desabilitar botão se valor zero, melhorar exibição de erro de cartão
- `supabase/functions/mp-create-order-and-pay/index.ts` — reordenar fluxo para criar pedido só após pagamento aceito (Passo 3A)
- Migration / SQL pontual — limpar os 6 pedidos órfãos do Genilton (Passo 4)

## O que NÃO vou mexer

- Lógica de cálculo de subtotal/desconto (está correta, validei contra o banco)
- `mp-checkout-init` (testei, retorna dados corretos)
- Schema das tabelas
- Fluxo de aprovação da proposta em `PropostaDigital.tsx`
