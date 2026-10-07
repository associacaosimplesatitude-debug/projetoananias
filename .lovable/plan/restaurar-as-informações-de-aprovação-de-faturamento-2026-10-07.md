# Restaurar as informações de Aprovação de Faturamento

## Diagnóstico confirmado
- `/admin/ebd/aprovacao-faturamento` abre uma página que atualmente não contém abas e consulta apenas propostas com status `AGUARDANDO_APROVACAO_FINANCEIRA`.
- Na conferência com a sessão atual, a página abriu normalmente, sem falhas nas requisições, mostrando zero pendências.
- O banco também não possui propostas nesse status neste momento, mas possui **1.222 faturadas e 151 pagas**. Esses registros não são consultados nessa página.
- As abas semelhantes existem em `/admin/ebd/propostas`, incluindo o componente compartilhado de Pedidos Confirmados.
- Isso explica a ausência das informações na página atual; não foi confirmado quando ou em qual alteração as abas deixaram de aparecer.

## Correção proposta
1. Manter a rota e restaurar três abas: **Aprovação Pendente**, **Faturado** e **Pedidos Confirmados**.
2. Preservar os cartões e as ações atuais de aprovar, revalidar e reprovar exclusivamente na aba de pendências.
3. Exibir as propostas faturadas em uma lista própria, com busca e informações do cliente, vendedor, valor e pedido, sem acrescentar ações de pagamento ou comissão.
4. Reutilizar a lista existente de Pedidos Confirmados, com os filtros e canais que ela já oferece.
5. Diferenciar carregamento, erro de consulta e ausência real de registros, para uma falha não parecer uma lista vazia.

## Escopo técnico
- Concentrar a alteração em `src/pages/admin/AprovacaoFaturamento.tsx`, usando os componentes atuais de abas e `AdminPedidosTab`.
- Manter consultas de pendências e faturadas separadas; carregar os registros faturados com paginação para não truncar a lista no limite de 1.000 registros.
- Carregar as listagens adicionais quando suas abas forem abertas e atualizar as consultas relevantes após aprovação.
- Não alterar RLS, dados, funções de aprovação, comissões, login, redirecionamentos nem a página de Propostas.

## Validação
- Conferir a compilação.
- Abrir a rota com a sessão autorizada e testar as três abas, a busca e os filtros disponíveis, sem aprovar ou reprovar pedidos reais.
- Confirmar que o estado de zero pendências continua correto e que faturados e pedidos confirmados aparecem quando existentes e permitidos para a conta.