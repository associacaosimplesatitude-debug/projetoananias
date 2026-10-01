# Corrigir duplicidade no card Performance de Vendedores

## Implementação
- Incluir `bling_order_id` nos dados de propostas já carregados para o card, sem mudar filtros ou fontes.
- No cálculo individual por vendedor, montar as chaves `vendedor_id + bling_order_id` das propostas faturadas/pagas.
- Priorizar a proposta: ignorar somente o valor do pedido com a mesma chave; manter seu cliente no conjunto de clientes ativos.
- Preservar pedidos sem `bling_order_id`, Mercado Pago, datas, comissão real e todos os demais cálculos.

## Validação
- Conferir a compilação.
- Comparar no banco o total anterior e o deduplicado para Glória Carreiro ou Elaine Ribeiro, garantindo que a ocorrência canônica foi preservada.
