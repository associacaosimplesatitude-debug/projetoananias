

# Adicionar Card "Balcao Penha" e Corrigir Erro de Build

## Problema

1. As vendas do balcao da loja Penha (tabela `vendas_balcao`) nao aparecem no dashboard de Resumo de Vendas -- nao existe card nem dados no RPC.
2. Erro de build no arquivo `ebd-email-cron/index.ts` por uso de `npm:resend@4.0.0` incompativel com o ambiente Deno.

## Solucao

### 1. Migracao SQL -- Recriar a funcao `get_sales_channel_totals`

Adicionar o campo `pdv_balcao` ao JSON de retorno da funcao RPC, agregando vendas da tabela `vendas_balcao` com `status = 'finalizada'`:

```sql
'pdv_balcao', (
  SELECT json_build_object(
    'valor', COALESCE(SUM(valor_total), 0),
    'qtd', COUNT(*)
  )
  FROM vendas_balcao
  WHERE status = 'finalizada'
    AND created_at >= v_start
    AND created_at < v_end
)
```

### 2. Alterar `SalesChannelCards.tsx`

**Tipo de retorno da query (linhas 187-201):** Adicionar `pdv_balcao: { valor: number; qtd: number }` ao tipo.

**`marketplaceData` (linhas 242-289):** Adicionar campo `pdvBalcao` com valor padrao `{ valor: 0, qtd: 0 }` e preenchimento a partir de `channelTotals.pdv_balcao`.

**`totalGeral` (linhas 292-322):** Somar `marketplaceData.pdvBalcao.valor` e `.qtd` aos totais.

**Novo card (antes do TOTAL GERAL, antes da linha 507):** Adicionar um `StandardCard` com:
- Titulo: "Balcao Penha"
- Icone: `Store` em amber
- Cores: amber/laranja (border-amber-200, bg from-amber-50 to-amber-100, text-amber-700)

### 3. Corrigir erro de build no `ebd-email-cron/index.ts`

Alterar a linha 3 de:
```typescript
import { Resend } from "npm:resend@4.0.0";
```
Para:
```typescript
import { Resend } from "npm:resend@^4.0.0";
```
Ou usar a URL do esm.sh:
```typescript
import { Resend } from "https://esm.sh/resend@4.0.0";
```

## Impacto

- Novo card "Balcao Penha" aparecera no dashboard com valores corretos
- Total Geral passara a incluir vendas do balcao
- Cards existentes nao serao afetados
- Erro de build sera corrigido

