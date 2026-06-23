
## Diagnóstico

A lentidão vem quase toda do **backend** (`supabase/functions/bling-search-product`), não do frontend. Para cada busca acontece o seguinte:

1. Até **4 chamadas sequenciais** ao Bling tentando `?codigo=`, `?nome=`, `?pesquisa=` (ativos e depois "todas situações") antes de retornar.
2. Para cada um dos até **10 produtos retornados**, o backend faz uma chamada extra `GET /produtos/{id}` com **`delay(350ms)` entre elas** → no pior caso ~3,5s + 10 requisições HTTP só nessa etapa.
3. Se a primeira busca vier vazia, o código **renova o token e refaz a busca**, dobrando o tempo.

Resultado típico: 4–8 segundos por digitação. O frontend já tem debounce de 400ms e React Query, então o gargalo real está no edge function.

## O que mudar

### 1. Eliminar o loop de "detalhes" sequencial (maior ganho)
A resposta de `/produtos?pesquisa=...` já traz `id`, `codigo`, `nome`, `preco`, `tipo` e `situacao` — o suficiente para listar no PDV. A chamada por item só era usada para tentar pegar `imagemURL` e descrição.

- Remover o `for` com `await delay(350)` + `fetchProductDetails` na resposta da busca.
- Mapear direto do resultado da busca para o shape que o frontend espera (`imagemURL` opcional, vazio quando não vier).
- Carregar a imagem de forma **lazy**, apenas quando o usuário clicar/adicionar um item — criar (ou reutilizar) endpoint dedicado `bling-product-details` chamado sob demanda pelo card.

Sozinho isso reduz a busca de ~4–7s para ~300–800ms.

### 2. Paralelizar as tentativas de busca
Em vez de cair em cascata `codigo → nome → pesquisa → todas-situações`:

- Quando parece SKU: disparar `codigo` (ativos) **e** `codigo` (criterio=5) em paralelo via `Promise.all`, retornar o primeiro não-vazio.
- Quando é texto: disparar `nome` e `pesquisa` (ambos com `criterio=5`) em paralelo e mesclar deduplicando por `id`.

Reduz latência da busca em si pela metade nas queries que hoje precisam de fallback.

### 3. Não renovar token em caso de "0 resultados"
Hoje, quando a busca volta vazia, o código assume que é erro de auth e força `refreshBlingToken` + nova busca, custando mais ~1–2s à toa.

- Só renovar se `fetchBling` receber **HTTP 401**. Propagar o status do fetch para detectar isso.

### 4. Cache leve em memória no edge function
Edge functions ficam "warm" por algum tempo.

- Adicionar um `Map<string, { products, ts }>` com TTL de 60s indexado pelo `query.toLowerCase()`. Buscas repetidas (usuário apagando/redigitando) viram instantâneas.
- Cachear também `accessToken` + `expires_at` em variável de módulo para evitar `select * from bling_config` em toda chamada.

### 5. Ajustes finos no frontend (`ShopifyPedidos.tsx`)
- Aumentar `staleTime` do `useQuery(['bling-products', termo])` para ~5 min e `gcTime` para 10 min — evita refetch ao voltar do carrinho ou re-renderizar.
- Manter `keepPreviousData: true` para não piscar/recarregar enquanto o usuário digita.
- Debounce de 400ms está bom; manter.

## Arquivos afetados

- `supabase/functions/bling-search-product/index.ts` — itens 1, 2, 3, 4.
- `supabase/functions/bling-product-details/index.ts` — criar (ou já existe? confirmar) para carregamento lazy da imagem.
- `src/pages/shopify/ShopifyPedidos.tsx` — item 5 e, no card do produto, chamar o endpoint de detalhe sob demanda quando `imagemURL` vier vazio.

## Ganho esperado

- Busca típica: **~500ms** (de 4–7s hoje).
- Buscas repetidas dentro de 1 min: **<100ms** (cache).
- Cliques em "Adicionar" continuam instantâneos; a imagem aparece com um pequeno fade quando o detalhe chega.

## Riscos

- Sem a chamada de detalhes, alguns produtos podem aparecer inicialmente sem imagem — mitigado pelo fetch lazy.
- Cache em memória do edge function não é compartilhado entre instâncias; é apenas otimização best-effort, sem impacto em correção.
