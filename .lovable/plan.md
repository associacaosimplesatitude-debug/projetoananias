Objetivo: corrigir a aba E-commerce em `src/components/admin/AdminPedidosTab.tsx` com a menor alteração possível, sem mexer em UI, abas, layout ou outras telas.

Problema confirmado
- A query da aba E-commerce já foi expandida para 3 fontes:
  - `ebd_shopify_pedidos`
  - `ebd_shopify_pedidos_cg`
  - `ebd_loja_pedidos_cg`
- Porém o terceiro select está fazendo:
  - `.from("ebd_loja_pedidos_cg").select("*, vendedor:vendedores(nome)")`
- Esse relacionamento não existe para `ebd_loja_pedidos_cg`.
- O preview mostra a requisição retornando `400 PGRST200` com a mensagem de que não há relação entre `ebd_loja_pedidos_cg` e `vendedores`.
- Como os 3 selects estão dentro de `Promise.all`, a falha de uma fonte derruba a query inteira, então `shopifyPedidos` não carrega e a aba fica zerada.

Plano de correção mínima
1. Editar somente `src/components/admin/AdminPedidosTab.tsx`.
2. Manter a estrutura atual da `useQuery(["admin-all-shopify-pedidos"])`.
3. Corrigir apenas o bloco da consulta de `ebd_loja_pedidos_cg` para não depender do join inexistente com `vendedores`.
4. Buscar `ebd_loja_pedidos_cg` sem relacionamento embutido e continuar resolvendo o nome do vendedor pelo fallback já existente no componente:
   - `pedido.vendedor?.nome || (pedido.vendedor_id ? vendedores.find(...) : null)`
5. Preservar o merge das três fontes e a ordenação por `created_at desc`.
6. Não tocar em filtros, colunas, tabs, badges, renderização ou mutations.

Resultado esperado
- A query deixa de quebrar.
- A aba E-commerce volta a carregar.
- Passam a aparecer juntas as 3 bases:
  - Shopify principal
  - Shopify CG legado
  - Nova Loja CG
- A contagem não ficará mais zerada e deve subir conforme os registros existentes.

Detalhes técnicos
- Arquivo: `src/components/admin/AdminPedidosTab.tsx`
- Trecho com erro atual:
  - `ebd_loja_pedidos_cg` usando `vendedor:vendedores(nome)` sem FK disponível
- Ajuste previsto:
  - trocar esse select por `select("*")` para `ebd_loja_pedidos_cg`
  - manter o mapeamento para `ShopifyPedido`
  - opcionalmente normalizar `vendedor: null` no mapping dessa fonte, se necessário para o tipo

Validação após implementar
- Abrir `/admin/ebd/propostas`
- Ir na aba `E-commerce`
- Confirmar que deixou de aparecer zero
- Confirmar que não há mais erro `PGRST200` dessa query no tráfego
- Confirmar que somente `AdminPedidosTab.tsx` foi alterado