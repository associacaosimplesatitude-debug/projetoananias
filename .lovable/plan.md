

# Adicionar Etapa "RECOMPRA" ao Funil de Vendas

## O que muda

Uma sexta etapa sera adicionada ao funil, chamada **RECOMPRA**, representando clientes que ja fizeram uma segunda compra (fidelizacao). A deteccao considera pedidos de 3 fontes: Shopify, Mercado Pago e Propostas Faturadas.

## Logica da Recompra

Um cliente e considerado "recompra" quando:
1. Ele aparece na lista de primeira compra (primeiro pedido pago a partir de Jan/2026 na `ebd_shopify_pedidos`)
2. E possui **pelo menos um segundo pedido pago** em qualquer uma destas tabelas:
   - `ebd_shopify_pedidos` (segundo pedido com `status_pagamento = 'paid'`)
   - `ebd_shopify_pedidos_mercadopago` (pedido com `status = 'PAGO'`, vinculado via `cliente_id` ou email)
   - `vendedor_propostas` (proposta com `status = 'FATURADO'`, vinculada via `cliente_id`)

O valor total acumulado dessas segundas compras sera exibido ao lado do label, igual ao "Primeira Compra".

## Visual

- Cor: dourado/amber (`bg-amber-500`) para destacar a fidelizacao
- Largura: 20% (menor que todas as outras, no fundo do funil)
- Icone: estrela ou coroa (usando `Star` do lucide-react)

## Alteracoes tecnicas

### 1. Banco de dados -- atualizar RPCs

**`get_funil_stage_counts`**: Adicionar contagem e valor total da recompra. A logica:

```text
WITH first_buyers AS (
  -- emails dos primeiros compradores a partir de Jan/2026
),
matched_clients AS (
  -- cruzamento com ebd_clientes
),
recompra AS (
  -- Para cada first_buyer, verificar se existe:
  --   1) Um segundo pedido em ebd_shopify_pedidos (mesmo email, created_at > primeira_compra)
  --   2) OU um pedido em ebd_shopify_pedidos_mercadopago (via cliente_id do matched, status = 'PAGO')
  --   3) OU uma proposta em vendedor_propostas (via cliente_id do matched, status = 'FATURADO')
)
-- retornar count e sum do valor dessas recompras
```

**`get_funil_stage_list`**: Adicionar case `recompra` que retorna a lista de clientes com valor e data da segunda compra.

### 2. Frontend -- `VendedorFunil.tsx`

- Adicionar `"recompra"` ao type `FunnelStage`
- Adicionar a 6a etapa no array `stages` com cor `bg-amber-500`, largura 20%, icone `Star`
- Parsear `recompra` e `recompra_total` do retorno da RPC `get_funil_stage_counts`
- Exibir o valor total ao lado do label "Recompra" (mesmo padrao do "Primeira Compra")
- A lista expandida mostrara os mesmos campos (nome, telefone, email, valor, data)

