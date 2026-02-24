
# Corrigir Rota de Frete: retirada_penha virando Retira Matriz

## Problema
Quando a proposta tem `metodo_frete = 'retirada_penha'`, o checkout converte para `'manual'`, que depois vira `'retirada'` (Matriz RJ). Resultado: pedido vai para deposito errado no Bling.

Cadeia: `retirada_penha` -> `manual` -> `retirada` -> Matriz RJ

## Correções (2 arquivos)

### 1. `src/pages/ebd/CheckoutShopifyMP.tsx` (linha 526)

Enviar o `metodo_frete` original da proposta em vez do `shippingMethod` generico:

```text
// DE:
frete: {
  metodo: shippingMethod,

// PARA:
frete: {
  metodo: proposta?.metodo_frete || shippingMethod,
```

Isso preserva `retirada_penha`, `retirada_pe`, `retirada`, `free`, etc.

### 2. `supabase/functions/mp-sync-payment-status/index.ts` (linhas 124-131)

Adicionar comentario de seguranca e manter a logica de fallback apenas para `'manual'`:

```text
// Normalizar metodo_frete: 'manual' -> 'retirada' (apenas se nao for retirada especifica)
let metodoFreteNormalizado = pedido.metodo_frete || 'pac';
if (metodoFreteNormalizado === 'manual') {
  if (pedido.valor_frete === 0 || pedido.valor_frete === null) {
    metodoFreteNormalizado = 'retirada';
  }
}
// Nao sobrescrever se ja for retirada especifica (retirada_penha, retirada_pe, etc.)
```

A correcao principal e no arquivo 1. Com o checkout enviando o valor correto, a normalizacao no webhook nao sera acionada porque o valor nunca mais chegara como `'manual'` quando for retirada especifica.
