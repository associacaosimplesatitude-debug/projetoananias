
# Mostrar datas e dias entre compras na etapa Recompra

## O que muda

Na lista expandida da etapa "Recompra", cada cliente passara a mostrar:
- **Data da 1a compra** (quando entrou no funil)
- **Data da 2a compra** (recompra mais recente)
- **Dias entre compras** (ex: "65 dias")

## Alteracoes tecnicas

### 1. Banco de dados -- atualizar RPC `get_funil_stage_list`

No case `recompra`, adicionar 3 campos ao retorno:
- `data_primeira_compra` (timestamptz) -- vem do CTE `first_buyers.primeira_compra`
- `data_recompra` (timestamptz) -- data do pedido mais recente (segundo pedido Shopify, MP ou proposta faturada)
- `dias_entre_compras` (integer) -- diferenca em dias entre as duas datas

A data da recompra sera calculada como o `MAX(created_at)` entre as 3 fontes (Shopify, MP, Propostas) que ocorreram apos a primeira compra.

### 2. Frontend -- `VendedorFunil.tsx`

- Adicionar campos `data_primeira_compra`, `data_recompra` e `dias_entre_compras` na interface `ClienteItem`
- No parsing da resposta da RPC, mapear esses 3 campos
- Na renderizacao da lista expandida, quando `expandedStage === "recompra"`, exibir:
  - "1a compra: DD/MM/AAAA"
  - "2a compra: DD/MM/AAAA"
  - Badge com "X dias" entre as compras
