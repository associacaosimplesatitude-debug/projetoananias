# Corrigir totais limitados a 1.000 pedidos

## Diagnóstico confirmado
- Em **Pedidos Confirmados**, as consultas de **Faturados B2B** e **Mercado Pago** em `AdminPedidosTab.tsx` não usam paginação. Os contadores usam o tamanho dessas listas e os valores financeiros somam apenas os registros recebidos, ficando limitados a 1.000.
- Consulta direta ao banco confirmou **1.376 Faturados B2B** (status `FATURADO`, `APROVADA_FATURAMENTO` e `PAGO`) e **1.180 pedidos Mercado Pago** (status `approved` e `PAGO`), sem filtros de período, vendedor ou busca.
- A aba principal **Faturado** já consulta em lotes e possui **1.222 registros** com status `FATURADO`. É uma seleção diferente de Faturados B2B; essa diferença será preservada.

## Correção proposta
1. Carregar todos os registros de Faturados B2B e Mercado Pago em lotes, antes de aplicar os filtros e calcular os contadores e somas.
2. Aplicar a mesma proteção à consulta de Balcão Penha no mesmo componente: hoje há 752 registros, mas ela também não possui paginação e apresentaria o problema ao ultrapassar 1.000.
3. Preservar filtros, status considerados, cálculos existentes, aparência e ações dos pedidos. Não alterar dados, aprovação, comissões, permissões ou funções.

## Detalhes técnicos
- Alterar apenas as consultas afetadas em `src/components/admin/AdminPedidosTab.tsx`.
- Usar `.range()` em lotes de 1.000, até receber um lote menor, com ordenação estável por `created_at` e `id`.
- Propagar erros de qualquer lote, evitando apresentar uma listagem parcial como completa.
- Preservar as chaves de cache existentes e a consulta já paginada de E-commerce.

## Validação
- Confirmar compilação sem erros.
- Com sessão autorizada, abrir Pedidos Confirmados e comparar os contadores sem filtros com novas contagens do banco.
- Conferir Faturados B2B, Mercado Pago e filtros de período/vendedor, além das somas com os mesmos critérios.
- Caso não haja sessão autorizada, informar explicitamente a limitação da validação visual.