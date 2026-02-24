

# Atualizar Saldo para Buscar do Google Ads

## Problema atual

O "Saldo Atual" na pagina de Recargas esta calculando a soma das recargas com status CONFIRMADO no banco local. O correto e buscar o saldo real (Fundos disponiveis) diretamente da conta do Google Ads via API.

## Solucao

### 1. Edge Function `google-ads-dashboard/index.ts`

Adicionar uma nova action `"balance"` que consulta o `account_budget` via GAQL para obter os fundos disponiveis da conta:

- Consultar `account_budget` com status APPROVED para obter o `amount_micros` (orcamento total aprovado)
- Consultar o custo total gasto (`metrics.cost_micros`) desde o inicio do orcamento ate hoje
- Calcular saldo = orcamento aprovado - custo total
- Retornar `{ balance: number, customer_id: string }`

Se a conta for de pagamento manual (pre-pago), o `amount_micros` do `account_budget` reflete os fundos depositados. A diferenca entre esse valor e o gasto total representa os fundos disponiveis.

### 2. `src/pages/admin/GoogleRecargas.tsx`

Alterar a query de saldo para chamar a edge function em vez de somar topups locais:

- Trocar a query que soma `google_ads_topups` com status CONFIRMADO
- Chamar `supabase.functions.invoke("google-ads-dashboard", { body: { action: "balance" } })`
- Exibir o valor retornado como "Saldo Atual"
- Adicionar loading state e tratamento de erro (exibir R$ 0,00 em caso de falha)

## Detalhes tecnicos

### Nova action "balance" na edge function

```text
GAQL query para account_budget:
  SELECT account_budget.amount_micros, account_budget.status
  FROM account_budget
  WHERE account_budget.status = 'APPROVED'

GAQL query para custo total acumulado:
  SELECT metrics.cost_micros
  FROM customer
  WHERE segments.date BETWEEN '<inicio_orcamento>' AND '<hoje>'

balance = (amount_micros - total_cost_micros) / 1_000_000
```

### Alteracao no frontend (GoogleRecargas.tsx)

A query `google-ads-saldo` passara de consulta ao banco local para chamada a edge function, retornando o saldo real da conta Google Ads.

