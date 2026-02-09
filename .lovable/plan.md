

# Plano: Corrigir Edge Function `parse-bank-statement`

## Problema

A funcao esta falhando no boot com o erro:
```
worker boot error: Unable to load .../edge-runtime.d.ts imported from .../parse-bank-statement/index.ts: path not found
```

A linha `import "npm:@supabase/functions-js/edge-runtime.d.ts"` nao e compativel com o runtime atual. Outras funcoes do projeto nao usam esse import.

## Correcoes

### Arquivo: `supabase/functions/parse-bank-statement/index.ts`

1. **Remover a linha 1** (`import "npm:@supabase/functions-js/edge-runtime.d.ts"`) - nao e necessaria, o `Deno.serve` funciona nativamente no edge runtime

2. **Atualizar CORS headers** para incluir todos os headers necessarios:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
```

3. **Tambem atualizar `verify_jwt`** no config.toml para `false` (a funcao ja valida o header de autorizacao manualmente no codigo, e o sistema de signing-keys nao funciona com `verify_jwt = true`)

Nenhuma outra alteracao necessaria - o resto do codigo (chamada OpenAI, parsing, etc.) esta correto.
