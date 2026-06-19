## Problema

1. Em `/vendedor/shopify` (PDV — `ShopifyPedidos.tsx`), buscar por palavra (ex.: "CONSOLO") retorna 0 resultados, mas buscar por SKU numérico funciona.
2. O filtro "Todas as Categorias" deve ser ocultado.

## Causa raiz da busca

Na Edge Function `bling-search-product`, quando o termo não é numérico, é feita uma única chamada:

```
GET /Api/v3/produtos?nome=CONSOLO&limite=10
```

O parâmetro `nome` no Bling v3 faz match restritivo (começa com / igual exato dependendo da conta) e ignora variações. O endpoint correto para busca textual ampla (nome + código + descrição) é `pesquisa=`, que é o mesmo usado pela barra de busca do próprio Bling. Por isso "CONSOLO" não retorna o produto "CONSOLO PARA …".

## Mudanças

### 1. `supabase/functions/bling-search-product/index.ts`
Atualizar `searchProducts()`:

- Se o termo for numérico → manter busca por `codigo=` (já funciona).
- Se o termo for textual:
  1. Tentar primeiro `?pesquisa=<termo>&limite=10` (busca ampla nativa do Bling).
  2. Se vier vazio, fallback para `?nome=<termo>&limite=10` (comportamento atual).
- Manter rate limiting, refresh de token e o mapeamento de `imagemURL` como já estão.
- Deploy da função.

### 2. `src/pages/shopify/ShopifyPedidos.tsx`
Ocultar o filtro de categorias do PDV do vendedor:

- Remover o bloco `{/* Category Filter */}` (Select de Categoria + Subcategoria + ícone `Filter`) do JSX (linhas ~1365-1409).
- Manter o botão "Limpar" apenas para limpar o `searchTerm`.
- Manter `selectedCategory='all'` fixo para que a lógica de `filteredProducts` continue funcionando sem mudanças (não filtra por categoria).
- Não remover as constantes/funções de categoria (são usadas para descontos por categoria do cliente em outras partes do arquivo).

## Fora de escopo

- Não alterar `src/lib/bling.ts`, `src/lib/shopify.ts`, `NovoPedidoDialog.tsx`, `categoriasShopify.ts`.
- Não mexer em `bling-check-stock` nem em tabelas Supabase.
- Layout dos cards de produto permanece igual.
