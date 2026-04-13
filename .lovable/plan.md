
Objetivo: investigar completamente por que a transferência de 3% falhou novamente e propor a correção exata sem mexer em código ainda.

Diagnóstico encontrado:
1. A falha atual não é mais o destination account.
2. O log mais recente da edge function `stripe-webhook` mostra:
   - `Transfer destination: acct_1TLch2QtDc37RJKx`
   - erro Stripe: `transfers_not_allowed`
   - mensagem: `For Transfers involving Brazil, the source_transaction parameter is mandatory`
3. Isso prova que:
   - o webhook está recebendo `payment_intent.succeeded`
   - o destination correto está sendo usado
   - a chamada `/v1/transfers` está acontecendo
   - a transferência falha porque, no Brasil, a API exige `source_transaction`
4. O código atual do webhook cria a transferência com:
   - `amount`
   - `currency`
   - `destination`
   - `transfer_group`
   - metadados
   Mas não envia `source_transaction`.
5. A tela e o banco confirmam o comportamento:
   - primeiro log `PAGO` no `payment_intent.succeeded`
   - segundo log `TRANSFERENCIA_FALHOU` em `transfer.created`

Evidências lidas:
- `supabase/functions/stripe-webhook/index.ts`
- `supabase/functions/stripe-test-payment/index.ts`
- logs recentes da função `stripe-webhook`
- screenshot com `TRANSFERENCIA_FALHOU`

Observações importantes:
- A validação de assinatura existe no webhook.
- O tratamento de `payment_intent.succeeded` existe.
- A gravação em `stripe_test_logs` existe.
- O problema é especificamente a ausência de `source_transaction` na requisição de transferência.
- Também encontrei um detalhe secundário: `stripe-test-payment` ainda grava `metadata[transfer_destination]` com o account antigo `acct_1TJE3cKCVupxwxRr`, mas isso não é a causa desta falha, porque o webhook hoje usa o secret `STRIPE_CONNECTED_ACCOUNT`.

Plano de implementação:
1. Atualizar `supabase/functions/stripe-webhook/index.ts`
   - no bloco `payment_intent.succeeded`
   - incluir `source_transaction` na chamada para `https://api.stripe.com/v1/transfers`
   - usar o identificador correto do charge liquidado do PaymentIntent
2. Tornar a captura do charge mais robusta
   - extrair de `pi.latest_charge` quando disponível
   - como fallback, tentar `pi.charges?.data?.[0]?.id`
   - se não houver charge disponível, gravar falha explícita no log em vez de tentar a transferência incompleta
3. Melhorar o log de auditoria em `stripe_test_logs`
   - manter `PAGO`
   - registrar `TRANSFERENCIA_EXECUTADA` quando sucesso
   - registrar `TRANSFERENCIA_FALHOU` com payload incluindo erro e, se útil, o `source_transaction` usado
4. Ajuste opcional mas recomendado
   - alinhar `supabase/functions/stripe-test-payment/index.ts` para deixar de gravar o account antigo nos metadados de teste
   - isso evita confusão futura nos diagnósticos, embora não seja o bloqueio atual
5. Deploy e validação
   - redeploy da `stripe-webhook`
   - executar um novo pagamento teste
   - confirmar nos logs:
     - `payment_intent.succeeded`
     - `Transfer destination: acct_1TLch2QtDc37RJKx`
     - transferência sem erro `transfers_not_allowed`
     - novo registro `TRANSFERENCIA_EXECUTADA`

Arquivo principal a alterar:
- `supabase/functions/stripe-webhook/index.ts`

Arquivo secundário recomendado:
- `supabase/functions/stripe-test-payment/index.ts`

Resultado esperado após a correção:
```text
PaymentIntent aprovado
   -> webhook recebe payment_intent.succeeded
   -> extrai charge liquidado
   -> cria transfer com source_transaction
   -> Stripe aceita a transferência Brasil
   -> stripe_test_logs registra TRANSFERENCIA_EXECUTADA
```

Risco principal:
- alguns eventos podem não trazer o charge de forma uniforme; por isso a implementação deve tratar fallback e logar claramente quando o charge não for encontrado.
