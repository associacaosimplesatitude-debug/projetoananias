

## Plano: Corrigir query de saldo do Google Ads

### Problema
A Edge Function `google-ads-dashboard` usa o campo `account_budget.amount_micros` que não existe na API v23. O campo correto é `account_budget.approved_spending_limit_micros`.

### Correção

**Editar:** `supabase/functions/google-ads-dashboard/index.ts`

Na função `handleBalance`, alterar:
1. A query GAQL de `account_budget.amount_micros` para `account_budget.approved_spending_limit_micros, account_budget.approved_spending_limit_type`
2. O parsing do resultado para usar `approvedSpendingLimitMicros` em vez de `amountMicros`
3. Tratar o caso em que `approved_spending_limit_type` é `INFINITE` (sem limite definido) — nesse caso, calcular saldo baseado apenas no custo acumulado ou retornar um indicador

