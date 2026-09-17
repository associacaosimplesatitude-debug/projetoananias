# Filtrar pedidos digitais em Atribuir Clientes

## Implementação
- Manter a consulta atual dos pedidos físicos e digitais.
- Somente quando `attributionMode` estiver ativo, buscar os SKUs em `ebd_shopify_pedidos_itens` para os pedidos retornados.
- Identificar como somente digital apenas pedidos com ao menos um item e com todos os SKUs iniciando por `DIG-`, sem diferenciar maiúsculas e minúsculas.
- Remover esses pedidos antes dos filtros de data, estatísticas, busca, paginação e contagem da lista.
- Preservar integralmente o comportamento quando `attributionMode` estiver desativado.

## Validação
- Confirmar que pedidos somente digitais não participam da lista nem dos totais em “Atribuir Clientes”.
- Confirmar que pedidos sem itens permanecem e que “Pedidos Online” continua exibindo pedidos digitais.
- Verificar o build após a alteração.

## Detalhes técnicos
- Alterar somente `src/pages/shopify/PedidosOnline.tsx`.
- Usar consultas em lotes pelos IDs dos pedidos para evitar limites de tamanho da URL e da resposta.
- Não alterar tabelas, funções externas, rotas ou estilos.
