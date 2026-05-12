## Objetivo
Garantir que toda conversa mostre a tag do vendedor na lista sempre que o modal de detalhes já conseguir identificar esse vendedor pelo telefone — inclusive casos de Gloria, Neila, Antonio e demais vendedores.

## O que vou alterar
1. Alinhar a busca de vendedor da lista de conversas com a lógica do modal de detalhes.
2. Incluir na lista o mesmo fallback usado no modal para pedidos Shopify com `vendedor_id` vinculado ao telefone.
3. Fortalecer o cruzamento por telefone para cobrir as mesmas variações aceitas no modal.
4. Manter a prioridade visual atual da tag:
   - Em atendimento: vendedor atribuído na conversa
   - Vendedor: qualquer vendedor resolvido por lead, cliente ou pedido
   - Sem vendedor: só quando houver vínculo de cliente sem nome de vendedor
   - Novo contato: apenas quando não existir nenhum vínculo

## Resultado esperado
Na lista de conversas, abaixo do nome do cliente, deve aparecer a tag com o nome do vendedor nos mesmos casos em que o modal mostra esse vendedor. Exemplo:
- `JULIO CESAR LOPES`
- `Vendedor: Daniel`

E o mesmo deve valer para clientes ligados a Gloria, Neila, Antonio e outros.

## Escopo e segurança
- Sem alterar comissões
- Sem alterar cadastro de clientes
- Sem mudar dados no banco
- Apenas ajuste de leitura e exibição no frontend

## Detalhes técnicos
- Atualizar `src/components/admin/WhatsAppChat.tsx` para usar a mesma cobertura de telefone do modal.
- Acrescentar resolução de vendedor via `ebd_shopify_pedidos.vendedor_id` quando houver pedido encontrado pelo telefone.
- Consolidar todos os `vendedor_id` encontrados em uma única consulta de nomes na tabela `vendedores`.
- Ajustar a montagem final da tag para que a lista nunca caia em `Novo contato` quando o modal já consegue resolver um vendedor.