# Combobox de materiais na licença manual

## Implementação
- Alterar somente o campo “Revista” do modal “Adicionar Licença Manual” em `RevistaLicencasAdmin.tsx`.
- Incluir `tipo_conteudo` na consulta dos materiais ativos.
- Substituir a lista simples por um combobox com busca por título usando `Popover` e `Command`.
- Dentro do combobox, incluir os filtros “Todos”, “Livros”, “Revistas” e “Infográficos”.
- Manter a seleção salvando o `id` escolhido em `formRevistaId` e exibir o título selecionado no botão.
- Preservar todos os demais campos, páginas, dados e estilos.

## Validação
- Confirmar busca parcial por título e filtragem por cada tipo de conteúdo.
- Confirmar que a escolha atualiza `formRevistaId` e fecha a lista.
- Verificar a compilação e a apresentação do modal em navegador.

## Detalhes técnicos
- Usar os componentes shadcn/ui já existentes: `Command`, `Popover`, `Tabs` e `Button`.
- Tratar `tipo_conteudo` estritamente como `livro_digital`, `revista` ou `infografico`, sem criar SKU ou alterar o banco.
