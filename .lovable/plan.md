

# Corrigir Saldo Google Ads - Erro na Query account_budget

## Problema

A query GAQL para `account_budget` retorna erro 400 "INVALID_ARGUMENT". O recurso `account_budget` pode nao estar disponivel para todos os tipos de conta Google Ads, ou requer o `login_customer_id` (conta MCC). Como resultado, o saldo sempre mostra R$ 0,00.

## Solucao

Modificar `handleBalance` na edge function para usar uma abordagem mais robusta com fallback:

### Arquivo: `supabase/functions/google-ads-dashboard/index.ts`

**Estrategia em 3 niveis:**

1. **Tentar `account_budget` sem WHERE** (a clausula WHERE pode ser a causa do erro):
   ```text
   SELECT account_budget.amount_micros, account_budget.status
   FROM account_budget
   ```
   Filtrar por status APPROVED no codigo TypeScript.

2. **Se falhar, tentar via `customer` (BillingSetup + custo mensal):**
   Usar a billing info que ja funciona (action "billing" funciona sem erro). Buscar o custo total do mes e subtrair de um valor de referencia.

3. **Se ambos falharem, fallback para calculo local:**
   Somar as recargas com status CONFIRMADO da tabela `google_ads_topups` e subtrair o custo total do mes obtido pela API de metricas (que funciona corretamente).

### Logica do fallback local:

```text
// Na edge function:
1. Tentar account_budget sem WHERE clause
2. Se erro, buscar custo do mes via metrics (que funciona)
3. Buscar soma de topups CONFIRMADOS no banco
4. balance = soma_topups - custo_total_gasto
```

Para o fallback funcionar, a edge function precisara ler da tabela `google_ads_topups` usando o supabase admin client.

### Alteracoes detalhadas:

1. **`handleBalance`**: Remover WHERE clause, adicionar try/catch com fallback
2. Dentro do fallback: consultar `google_ads_topups` com status CONFIRMADO para soma dos depositos
3. Consultar metricas de custo total (query que ja funciona)
4. Retornar `depositos - custo_total` como saldo estimado

### Arquivo: `src/pages/admin/GoogleRecargas.tsx`

Nenhuma alteracao necessaria no frontend -- a query ja chama a edge function e exibe o resultado.

## Resumo

- Primeiro tenta buscar saldo real via `account_budget` (sem WHERE)
- Se a API nao suportar, calcula saldo = recargas confirmadas - custo total gasto
- O frontend continua funcionando sem alteracoes

