## Objetivo
Fazer a tag exibida abaixo do nome do cliente na lista de conversas mostrar o nome do vendedor quando esse vendedor já puder ser identificado pelo telefone, igual ao que já acontece no modal de detalhes.

## O que vou alterar
1. Ajustar a regra de montagem da tag na lista de conversas em `src/components/admin/WhatsAppChat.tsx`.
2. Usar o vendedor histórico encontrado pelo telefone mesmo quando ainda não existir `clienteId` em `agente_ia_conversas`.
3. Manter a prioridade atual da exibição:
   - Em atendimento: vendedor atribuído da conversa
   - Vendedor: vendedor histórico encontrado por cliente/lead
   - Sem vendedor: somente quando houver cliente sem nome de vendedor
   - Novo contato: apenas quando realmente não houver vínculo com vendedor

## Resultado esperado
Para casos como o informado por você, a conversa vai mostrar a tag verde com o nome do vendedor abaixo do cliente, por exemplo:
- `JULIO CESAR LOPES`
- `Daniel`

## Escopo e segurança
- Sem alterar comissões
- Sem alterar cadastro de cliente
- Sem mudar dados no banco
- Apenas ajuste de leitura/exibição no frontend

## Detalhe técnico
Hoje a lista exige `clienteId && vendedorHistoricoNome` para exibir `vendedor_historico`. O modal já consegue achar o vendedor por outras fontes ligadas ao telefone. Vou alinhar a lista para considerar `vendedorHistoricoNome` suficiente quando ele já tiver sido resolvido pelas consultas existentes, evitando que caia em `novo_contato` indevidamente.