
# Corrigir venda "Mulheres Em Reforma" nao aparecendo no historico

## Problema identificado

Dois problemas impedem esta venda de aparecer:

1. **Campo `codigo_bling` vazio**: O livro "Mulheres Em Reforma" tem o `bling_produto_id` correto (16432851406), mas o `codigo_bling` esta nulo. O codigo no Bling e **33455** (visivel na imagem). A funcao de sync usa ambos os campos para mapear itens da NFe ao livro -- se a NFe referencia o produto pelo codigo (33455), o match falha.

2. **Limite de processamento**: O sync processa apenas 30 NFes por execucao (de 487 disponiveis). A NFe desta venda pode estar alem das primeiras 30.

## Solucao

### 1. Atualizar `codigo_bling` do livro (migracao SQL)

Preencher o campo `codigo_bling` com "33455" para o livro "Mulheres Em Reforma".

```text
UPDATE royalties_livros 
SET codigo_bling = '33455' 
WHERE id = '538778df-379a-4dd3-add3-e0ced5929796';
```

### 2. Re-executar o sync

Apos a correcao, executar novamente o sync com parametros que cubram a data de hoje e processem mais NFes para garantir que a NFe do pedido 030815 seja encontrada.

Nao ha alteracoes de codigo necessarias -- apenas a correcao do dado no banco e re-execucao do sync.
