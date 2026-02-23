
# Correcao CORS na Edge Function Google Ads

## Problema

A Edge Function `google-ads-data` tem uma lista fixa de origens permitidas (allowedOrigins) que inclui apenas `gestaoebd.com.br` e `localhost:5173`. O preview do Lovable usa o dominio `*.lovableproject.com` e `*.lovable.app`, que estao sendo bloqueados pelo CORS, resultando em "Failed to fetch" em todas as 3 chamadas (metrics, balance, invoices).

## Solucao

Atualizar o CORS da Edge Function para usar `Access-Control-Allow-Origin: *` conforme o padrao recomendado para Edge Functions, em vez de uma lista fixa de origens.

## Arquivo a modificar

**`supabase/functions/google-ads-data/index.ts`** - Simplificar a funcao `getCorsHeaders` para retornar `*` no header `Access-Control-Allow-Origin`, seguindo o padrao padrao de CORS para Edge Functions:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
```

Remover a funcao `getCorsHeaders(req)` e usar o objeto `corsHeaders` diretamente em todas as respostas. A seguranca ja esta garantida pela validacao do token JWT do usuario no corpo da funcao.

Apos a correcao, fazer redeploy da funcao.
