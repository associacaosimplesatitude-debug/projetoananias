

# Deploy + Correção CORS: mp-checkout-init

## Problema Atual

A função `mp-checkout-init` está com dois problemas:

1. **404 NOT_FOUND** - A função não está deployada no Supabase
2. **CORS Bloqueado** - Quando deployada, o navegador bloqueia por configuração CORS inadequada

### Sintomas no Checkout
- Produtos: 0 itens
- Valor: R$ 0,00
- Dados do cliente: vazios
- Erro no console: `FunctionsFetchError`, status 406, CORS blocked

---

## Solução em Pacote Único

### 1. Correção do CORS no Código

**Arquivo:** `supabase/functions/mp-checkout-init/index.ts`

**Mudanças:**

```typescript
// ANTES (problemático)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// DEPOIS (correto)
const ALLOWED_ORIGINS = [
  'https://gestaoebd.com.br',
  'https://www.gestaoebd.com.br',
  'http://localhost:5173',
];

function getCorsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) 
    ? origin 
    : ALLOWED_ORIGINS[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
  };
}
```

**Handler OPTIONS:**

```typescript
if (req.method === 'OPTIONS') {
  const origin = req.headers.get('Origin');
  return new Response('ok', { 
    status: 200, 
    headers: getCorsHeaders(origin) 
  });
}
```

**Todas as respostas com CORS:**

Garantir que TODA resposta (200, 400, 404, 500) inclua os headers CORS:

```typescript
const origin = req.headers.get('Origin');
const corsHeaders = getCorsHeaders(origin);

// Em cada return:
return new Response(JSON.stringify({...}), {
  status: XXX,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});
```

### 2. Deploy da Função

Após a correção do código, fazer deploy manual imediato.

---

## Implementação Detalhada

| Linha | Mudança |
|-------|---------|
| 5-8 | Substituir `corsHeaders` estático por `ALLOWED_ORIGINS` array + função `getCorsHeaders()` |
| 10-12 | Capturar origin no início: `const origin = req.headers.get('Origin')` |
| 11-13 | OPTIONS retorna `'ok'` com status 200 (não mais `null`) |
| 36-39 | Erro 400 usa `getCorsHeaders(origin)` |
| 59-62 | Erro 404 usa `getCorsHeaders(origin)` |
| 147-150 | Sucesso 200 usa `getCorsHeaders(origin)` |
| 153-156 | Erro 500 usa `getCorsHeaders(origin)` |

---

## Validação Pós-Deploy

| Teste | Esperado |
|-------|----------|
| `OPTIONS /mp-checkout-init` | **200 OK** com headers CORS |
| `POST /mp-checkout-init` sem body | **400 Bad Request** (não CORS blocked) |
| `POST /mp-checkout-init` com proposta válida | **200 OK** com dados |
| Checkout no navegador | Produtos e cliente carregam |

---

## Resultado Esperado

**DevTools Network:**
- OPTIONS → 200 ✅
- POST → 200/400/401 (nunca bloqueado por CORS) ✅

**Checkout:**
- Produtos da proposta aparecem ✅
- Dados do cliente preenchidos ✅
- Valor total correto ✅

