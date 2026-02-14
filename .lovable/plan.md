
# Mostrar valor da primeira compra na etapa Recompra

## O que muda

Na lista expandida da etapa "Recompra", alem das datas e dias entre compras, cada cliente passara a mostrar tambem o **valor da primeira compra** (vindo do pedido Shopify original).

## Alteracoes tecnicas

### 1. Banco de dados -- atualizar RPC `get_funil_stage_list`

No case `recompra`, o CTE `first_buyers` ja faz join com o pedido original e tem acesso ao `p.valor_total`. Basta:
- Carregar esse valor atraves dos CTEs (`first_buyers` -> `matched` -> `recompra_clients`)
- Retornar como `valor_primeira_compra` no SELECT final

### 2. Frontend -- `VendedorFunil.tsx`

- Adicionar campo `valor_primeira_compra` na interface `ClienteItem`
- Mapear o novo campo no parsing da RPC
- Na renderizacao da etapa "recompra", exibir o valor da primeira compra com icone de cifrao, similar ao valor de recompra ja exibido
- Layout: mostrar ambos os valores lado a lado ou empilhados para facil comparacao
