
# Plano: Campo Preco de Capa + Relatorio no Padrao do Modelo

## Resumo

Duas alteracoes: (1) adicionar campo "Preco de Capa" no cadastro de livros (o campo atual `valor_capa` passa a ser o valor liquido, e um novo campo `preco_capa` armazena o preco de capa real); (2) reformular o relatorio de vendas para seguir o layout do modelo fornecido, com colunas: Codigo, Titulo, Status, Quantidade Vendida, Compras do Autor, Preco de Capa, Menor Valor Vendido, Preco Liquido Medio, Taxa de Royalty, Royalties Apurado.

## Alteracoes

### 1. Migration: Novo campo `preco_capa` na tabela `royalties_livros`

Adicionar coluna `preco_capa NUMERIC DEFAULT 0` na tabela. O campo existente `valor_capa` continua como valor liquido.

### 2. Atualizar `LivroDialog.tsx`

- Adicionar campo "Preco de Capa (R$)" no formulario, entre o campo de Autor e o campo "Valor Liquido"
- Renomear label atual de "Valor Liquido (R$)" para deixar claro que e o valor liquido
- Incluir `preco_capa` no formData, no payload de submit, e no carregamento de dados existentes

### 3. Atualizar `Livros.tsx` (tabela de listagem)

- Exibir a coluna "Preco de Capa" separada da coluna "Valor Capa" (que e o valor liquido)
- Ou renomear a coluna existente para "Valor Liquido" e adicionar "Preco de Capa"

### 4. Reformular Relatorio de Vendas (`Relatorios.tsx`)

Alterar a tabela do relatorio de vendas para seguir o modelo da imagem:

| Coluna | Origem |
|--------|--------|
| Codigo | `royalties_livros.codigo_bling` |
| Titulo | `royalties_livros.titulo` |
| Status do Livro | `royalties_livros.is_active` (Ativo/Inativo) |
| Quantidade Vendida | soma de `royalties_vendas.quantidade` por livro |
| Compras do Autor | (campo novo ou calculado - sera 0 por padrao) |
| Preco de Capa | `royalties_livros.preco_capa` |
| Menor Valor Vendido | `MIN(royalties_vendas.valor_unitario)` por livro |
| Preco Liquido Medio no Periodo | `AVG(royalties_vendas.valor_unitario)` ou media ponderada |
| Taxa de Royalty | `royalties_comissoes.percentual` |
| Royalties Apurado | soma de `royalties_vendas.valor_comissao_total` |

Os dados serao agrupados por livro (nao por venda individual), com totalizacao no final.

### 5. Atualizar Exportacao PDF (`royaltiesExport.ts`)

Ajustar o export PDF do relatorio de vendas para seguir o mesmo layout do modelo:
- Cabecalho com dados do autor, periodo
- Tabela com as mesmas colunas
- Totalizacao "TOTAL DE ROYALTIES APURADO" no rodape

## Detalhes Tecnicos

- Nova coluna: `ALTER TABLE royalties_livros ADD COLUMN preco_capa NUMERIC DEFAULT 0;`
- O relatorio de vendas passa a agrupar por livro no periodo, calculando agregacoes (SUM quantidade, MIN valor_unitario, AVG valor_unitario, SUM comissao)
- A query do relatorio sera ajustada para trazer dados dos livros com join nas comissoes
- O campo "Compras do Autor" pode ser preenchido futuramente; por hora sera exibido como 0
