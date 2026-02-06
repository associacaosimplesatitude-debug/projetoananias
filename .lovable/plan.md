

# Plano de Correção Completa do Checkout (CORS + user_roles)

## Resumo do Problema

Identificamos 3 problemas críticos no fluxo de checkout:

1. **`calculate-shipping`**: CORS desatualizado (usa `*` ao invés de allowlist, OPTIONS retorna `null`)
2. **`mp-create-order-and-pay`**: CORS desatualizado (mesmo problema)
3. **`user_roles`**: Uso de `.single()` causa erro 406 quando usuário não tem role

---

## Parte A: Correção CORS das Edge Functions

### Padrão CORS a Aplicar

Ambas as funções receberão o mesmo padrão já implementado em `mp-checkout-init`:

```typescript
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

### Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `supabase/functions/calculate-shipping/index.ts` | Substituir `corsHeaders` estático por `getCorsHeaders(origin)` + OPTIONS retorna `'ok'` com status 200 |
| `supabase/functions/mp-create-order-and-pay/index.ts` | Mesma substituição |

### Detalhes de Implementação

**calculate-shipping/index.ts**:
- Linha 4-7: Substituir `const corsHeaders = {...}` por `ALLOWED_ORIGINS` + `getCorsHeaders()`
- Linha 9: Adicionar `const origin = req.headers.get('Origin')`
- Linha 10-11: OPTIONS retorna `Response('ok', { status: 200, headers: getCorsHeaders(origin) })`
- Todas as respostas usam `getCorsHeaders(origin)` dinamicamente

**mp-create-order-and-pay/index.ts**:
- Linha 5-8: Substituir `const corsHeaders = {...}` por `ALLOWED_ORIGINS` + `getCorsHeaders()`
- Linha 84: Capturar origin antes do try
- Linha 85-86: OPTIONS retorna status 200 com `'ok'`
- Linha 67-82: Atualizar `createCardErrorResponse` para receber origin
- Todas as respostas (200, 400, 500) incluem `getCorsHeaders(origin)`

---

## Parte B: Deploy e Verificação

### Funções a Deployar

1. `calculate-shipping`
2. `mp-create-order-and-pay`

### Testes Esperados

| Endpoint | OPTIONS | POST sem body | POST válido |
|----------|---------|---------------|-------------|
| calculate-shipping | 200 | 400 (JSON error) | 200 (frete) |
| mp-create-order-and-pay | 200 | 400 (validation) | 200/401 |

---

## Parte C: Correção do Erro 406 (user_roles)

### Problema

Os hooks `useAuth.tsx` e `useUserRole.tsx` usam `.single()` para buscar role, causando erro PGRST116 / 406 quando o usuário não tem role cadastrada.

### Arquivos a Modificar

| Arquivo | Linha | Mudança |
|---------|-------|---------|
| `src/hooks/useAuth.tsx` | 60 | `.single()` → `.maybeSingle()` |
| `src/hooks/useUserRole.tsx` | 30 | `.single()` → `.maybeSingle()` |

### Detalhes de Implementação

**useAuth.tsx** (linha 55-63):
```typescript
const fetchUserRole = async (userId: string) => {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();  // ← Mudança aqui
  
  setRole(data?.role || null);
  setLoading(false);
};
```

**useUserRole.tsx** (linha 26-37):
```typescript
const { data, error } = await supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id)
  .maybeSingle();  // ← Mudança aqui

if (error) {
  console.warn('Role não encontrada:', error.message);  // warn ao invés de error
  setRole(null);
} else {
  setRole(data?.role as AppRole || null);
}
```

**Comportamento após correção**:
- Se usuário não tem role → `data = null` → `role = null` → sem erro 406
- Console mostra warning ao invés de erro fatal
- Tela não quebra

---

## Parte D: Critérios de Sucesso

### DevTools > Network

| Request | Status Esperado |
|---------|-----------------|
| OPTIONS calculate-shipping | 200 |
| POST calculate-shipping | 200 (ou 400/401 se erro de validação) |
| OPTIONS mp-create-order-and-pay | 200 |
| POST mp-create-order-and-pay | 200 (ou 400/401 se erro de validação) |
| GET user_roles | 200 (mesmo sem resultados) |

### Console

- ❌ Sem "CORS blocked"
- ❌ Sem 406 de user_roles
- ❌ Sem "Failed to fetch"

### Checkout

- ✅ Produtos carregam
- ✅ Frete calcula corretamente
- ✅ Pagamento processa (ou mostra erro de negócio, não CORS)

---

## Ordem de Execução

1. Corrigir `calculate-shipping/index.ts` (CORS)
2. Corrigir `mp-create-order-and-pay/index.ts` (CORS)
3. Deploy das duas funções
4. Testar OPTIONS de ambas (espera 200)
5. Corrigir `useAuth.tsx` (maybeSingle)
6. Corrigir `useUserRole.tsx` (maybeSingle)
7. Validar checkout completo

---

## Seção Técnica

### Diferença entre `.single()` e `.maybeSingle()`

| Método | 0 rows | 1 row | 2+ rows |
|--------|--------|-------|---------|
| `.single()` | ❌ PGRST116 (406) | ✅ data | ❌ PGRST116 |
| `.maybeSingle()` | ✅ null | ✅ data | ❌ PGRST116 |

### Por que allowlist ao invés de `*`?

O `Access-Control-Allow-Origin: *` é rejeitado por alguns navegadores quando combinado com credentials. A allowlist garante compatibilidade e é mais seguro.

### Max-Age: 86400

Cache do preflight por 24 horas reduz chamadas OPTIONS subsequentes.

