
# Adicionar Card "PDV Balcao" ao Resumo de Vendas

## Problema

As vendas realizadas no balcao da loja Penha (tabela `vendas_balcao`) nao aparecem no dashboard de Resumo de Vendas. Essas vendas incluem pagamentos via cartao de credito, debito, dinheiro e PIX, mas nao estao sendo contabilizadas em nenhum card nem no Total Geral.

Dados confirmados: existem diversas vendas na tabela `vendas_balcao` com status "finalizada", todas no polo "penha".

## Solucao

### 1. Alterar a funcao RPC `get_sales_channel_totals` no banco de dados

Adicionar um novo campo `pdv_balcao` na funcao que agrega vendas da tabela `vendas_balcao` com `status = 'finalizada'` no periodo selecionado.

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

### 2. Alterar o componente `SalesChannelCards.tsx`

- Adicionar `pdv_balcao` ao tipo de retorno da query RPC (linha 187-201)
- Adicionar os dados de PDV Balcao no `marketplaceData` (ou `periodMetrics`)
- Incluir o valor do PDV Balcao no calculo do `totalGeral`
- Adicionar um novo `StandardCard` para "PDV Balcao" com icone `Store` e cores distintas (ex: amber/laranja)

### Detalhes tecnicos

**Migracao SQL:** Recriar a funcao `get_sales_channel_totals` adicionando o campo `pdv_balcao` no JSON de retorno.

**Frontend:** Adicionar o card entre os existentes, antes do TOTAL GERAL, e somar seu valor/quantidade no total geral.

**Impacto:** Nenhuma quebra nos cards existentes. Apenas adicao de um novo canal de venda ao dashboard.
