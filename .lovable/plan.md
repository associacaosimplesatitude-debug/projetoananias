## Causa raiz

A tela `Orçamento Transportadora` (`/vendedor/calculadora-peso`) mostra `0g` de peso e `0` volumes porque o catálogo agora vem da **Nova Loja** (via edge function externa `catalogo-publico`), que **não retorna peso**.

Em `src/lib/shopify.ts` (`fetchShopifyProducts`), todo produto é mapeado com:
```
weight: null,
weightUnit: null,
```

Como `weightKg` fica 0 para todos os itens, o cálculo de `pesoTotal` e `infoCaixas.totalVolumes` (que depende do peso) resulta em zero.

A função `bling-sync-products` já sabe ler `pesoBruto` do Bling, mas só popula `ebd_revistas` — não cobre o catálogo geral usado pela calculadora.

## Plano

### 1. Nova edge function `bling-get-product-weight`
Arquivo: `supabase/functions/bling-get-product-weight/index.ts`
- Recebe `{ sku: string }` (ou array de SKUs).
- Reaproveita a lógica de token (`refreshBlingToken`, `isTokenExpired`) e busca por `codigo` igual ao `bling-search-product`.
- Para cada SKU encontrado, chama `GET /produtos/{id}` e retorna `{ sku, pesoBruto, pesoLiquido }` em kg.
- Mantém respeito ao rate limit do Bling (`delay(350)` entre chamadas).
- Configurada com `verify_jwt = false` no `supabase/config.toml` (consumida pelo painel do vendedor autenticado).

### 2. Cache local de pesos
Tabela: `shopify_produto_pesos`
```
sku text primary key
peso_bruto_kg numeric not null default 0
peso_liquido_kg numeric not null default 0
updated_at timestamptz default now()
```
RLS: leitura para `authenticated`, escrita só via service role (edge function).

### 3. Integração na calculadora
Arquivo: `src/pages/vendedor/VendedorCalculadoraPeso.tsx`
- Em `adicionarProduto`: se `weightKg === 0` e existir `variant.sku`:
  1. Consultar `shopify_produto_pesos` pelo SKU.
  2. Se ausente, invocar `bling-get-product-weight`, persistir e usar o resultado.
  3. Atualizar o item no carrinho com `weightKg` obtido (`setCarrinho` com novo valor).
- Mostrar spinner inline ou toast "Buscando peso..." durante a consulta.
- Tratar falha: manter `weightKg = 0` mas exibir aviso "Peso não disponível para este SKU".

### 4. Permitir ajuste manual (fallback)
No carrinho (linhas 970–990 do arquivo), adicionar um campo numérico discreto de peso (kg) por linha que sobrescreve `weightKg` caso o vendedor queira corrigir.

### 5. Backfill opcional
Botão "Sincronizar pesos do Bling" na própria tela (visível só para admin/representante) que percorre o catálogo carregado e popula `shopify_produto_pesos` em background — opcional para uma fase 2.

## Detalhes técnicos

- Não modificamos o projeto externo da Nova Loja.
- O cache evita estourar o rate limit do Bling em sessões repetidas.
- Mantém compat com `convertToKg` (a função do Bling já retorna kg, então `unit = 'kg'`).
- O cálculo `calcularCaixasDetalhado(calculo.pesoTotal)` volta a funcionar assim que `weightKg` for preenchido.

## Arquivos afetados

- novo: `supabase/functions/bling-get-product-weight/index.ts`
- novo: migração com a tabela `shopify_produto_pesos` + RLS
- editar: `supabase/config.toml` (registrar a nova function se necessário)
- editar: `src/pages/vendedor/VendedorCalculadoraPeso.tsx` (enriquecer carrinho + campo manual)
- (opcional) editar: `src/lib/shopify.ts` para tipar `weight` como opcional