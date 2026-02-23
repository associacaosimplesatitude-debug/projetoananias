

# Correção: Atualizar versão da API do Google Ads

## Problema identificado

O OAuth está funcionando corretamente (credenciais salvas estão OK), mas a API retorna **404 Not Found** porque a versão `v18` da Google Ads API foi descontinuada.

A URL que está falhando:
```
https://googleads.googleapis.com/v18/customers/6403318992/googleAds:searchStream
```

## Correção

Atualizar todas as referências de `v18` para `v19` no arquivo `supabase/functions/google-ads-data/index.ts`:

1. **Linha 68** - URL do `searchStream` (usada para metrics e balance)
2. **Linha ~180** - URL de invoices

Sao apenas 2 alteracoes de string no mesmo arquivo.

## Arquivo a modificar

- `supabase/functions/google-ads-data/index.ts` - Trocar `v18` por `v19` em todas as URLs da API

## Apos a correção

Vou fazer deploy da Edge Function e testar novamente as 3 acoes: metrics, balance e invoices.
